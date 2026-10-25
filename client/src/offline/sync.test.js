import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeTaskServer } from '../test/fakeTaskServer'
import { server } from '../test/server'
import notify from '../utils/notify'
import { setToken } from '../utils/auth'
import { getAllTasks, getMeta, getTask, wipeOfflineData } from './db'
import { flushPending, getSyncState, pullFromServer, resetSyncEngine, syncNow } from './sync'
import { createTask, deleteTask, editTask, setTaskStatus } from './taskStore'

/**
 * Offline sync engine, exercised end to end against an in-memory fake of the API (MSW) and a real
 * IndexedDB implementation (fake-indexeddb). Local changes are made while "offline" so the engine's
 * debounced auto-flush never races the test; each test then goes online and flushes explicitly.
 */
const payload = (title, extra = {}) => ({
  title,
  category: 'Personal',
  schedule_type: 'once',
  due_date: '2026-06-01T10:00:00.000Z',
  ...extra,
})

let api

const setOnline = (value) => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value)
}
const create = (title, extra) => createTask(payload(title, extra), { silent: true })
const localTasks = async () => (await getAllTasks()).sort((a, b) => String(a.title).localeCompare(String(b.title)))
const titles = async () => (await localTasks()).map((t) => t.title)

beforeEach(async () => {
  api = createFakeTaskServer()
  server.use(...api.handlers)
  setToken('access-token')
  await wipeOfflineData()
  resetSyncEngine()
  setOnline(false)
  vi.spyOn(notify, 'error').mockImplementation(() => 'toast-id')
})

afterEach(() => {
  resetSyncEngine() // cancels any retry / debounce timer a test left behind
})

describe('offline queueing', () => {
  it('keeps changes made offline in IndexedDB and sends nothing', async () => {
    await create('Pay rent')
    await create('Call mum')

    expect(api.log).toHaveLength(0)
    const stored = await localTasks()
    expect(stored).toHaveLength(2)
    expect(stored.every((t) => t.needsSync && t.syncAction === 'create' && t.id.startsWith('local_'))).toBe(true)
  })

  it('refuses to flush while offline and leaves the queue untouched', async () => {
    await create('Pay rent')
    await expect(flushPending()).resolves.toEqual({ ok: false, reason: 'offline' })
    expect(api.log).toHaveLength(0)
    expect((await localTasks())[0].needsSync).toBe(true)
  })

  it('does not flush without a session token', async () => {
    await create('Pay rent')
    localStorage.clear()
    setOnline(true)
    await expect(flushPending()).resolves.toEqual({ ok: false, reason: 'offline' })
    expect(api.log).toHaveLength(0)
  })

  it('uploads the queue when the connection returns and replaces local ids with server ids', async () => {
    await create('Pay rent')
    await create('Call mum')
    setOnline(true)

    await expect(flushPending()).resolves.toEqual({ ok: true, synced: 2 })

    expect(api.live.map((t) => t.title).sort()).toEqual(['Call mum', 'Pay rent'])
    const stored = await localTasks()
    expect(stored.map((t) => t.id).sort()).toEqual(api.live.map((t) => t.id).sort())
    expect(stored.every((t) => !t.needsSync && !t.id.startsWith('local_') && t.syncAction === null)).toBe(true)
    expect(stored.every((t) => api.get(t.id))).toBe(true)
    expect(getSyncState()).toMatchObject({ pending: 0, syncing: false, lastResult: { type: 'success', count: 2 } })
  })

  it('sends creates first, then edits, then deletes', async () => {
    const edited = api.seed({ title: 'Edit me' })
    const doomed = api.seed({ title: 'Delete me' })
    await pullFromServer()
    api.clearLog()

    await deleteTask(doomed.id, { silent: true })
    await editTask(edited.id, { title: 'Edited' }, { silent: true })
    await create('Brand new')
    setOnline(true)
    await flushPending()

    const writes = api.log.filter((r) => r.method !== 'GET').map((r) => r.method)
    expect(writes).toEqual(['POST', 'PUT', 'DELETE'])
    expect(api.get(edited.id).title).toBe('Edited')
    expect(api.get(doomed.id).deleted).toBe(true)
  })

  it('sends a completion made offline after the create, against the server id', async () => {
    const task = await create('Water plants')
    await setTaskStatus(task.id, 'completed', { silent: true })
    setOnline(true)
    await flushPending()

    const [post, patch] = api.log.filter((r) => r.method !== 'GET')
    expect(post.method).toBe('POST')
    expect(patch.method).toBe('PATCH')
    expect(patch.path).toBe(`/tasks/${api.live[0].id}`)
    expect(patch.body).toEqual({ status: 'completed' })
    expect(api.live[0].status).toBe('completed')
  })

  it('drops a reminder that was created and deleted offline without ever calling the API', async () => {
    const task = await create('Oops')
    await deleteTask(task.id, { silent: true })
    setOnline(true)
    await flushPending()
    expect(api.log.filter((r) => r.method !== 'GET')).toHaveLength(0)
    expect(await localTasks()).toHaveLength(0)
  })
})

describe('idempotent retries', () => {
  it('does not duplicate a reminder when the response to a create is lost', async () => {
    await create('Dentist')
    setOnline(true)
    api.fail({ method: 'POST', mode: 'lose-response' })

    // The server stored it, but the client never heard back.
    await expect(flushPending()).resolves.toEqual({ ok: false, reason: 'error' })
    expect(api.live).toHaveLength(1)
    const [waiting] = await localTasks()
    expect(waiting).toMatchObject({ needsSync: true, syncAction: 'create' })
    expect(waiting.id.startsWith('local_')).toBe(true)

    // The retry carries the same client_id, so the server answers with the existing record.
    await expect(flushPending()).resolves.toMatchObject({ ok: true })
    const posts = api.requests('POST')
    expect(posts).toHaveLength(2)
    expect(posts[1].body.client_id).toBe(posts[0].body.client_id)
    expect(posts[0].body.client_id).toBe(waiting.clientId)
    expect(api.live).toHaveLength(1)

    const stored = await localTasks()
    expect(stored).toHaveLength(1)
    expect(stored[0]).toMatchObject({ id: api.live[0].id, needsSync: false })
  })

  it('does not show a pulled copy of its own half-finished create as a second reminder', async () => {
    await create('Dentist')
    setOnline(true)
    api.fail({ method: 'POST', mode: 'lose-response' })
    await flushPending()

    await pullFromServer() // the server already has it, with our client_id
    expect(await localTasks()).toHaveLength(1)
    expect((await localTasks())[0].id.startsWith('local_')).toBe(true)
  })

  it('treats a repeated delete (404) as success', async () => {
    const doomed = api.seed({ title: 'Gone already' })
    await pullFromServer()
    await deleteTask(doomed.id, { silent: true })
    api.remove(doomed.id) // another device deleted it first
    setOnline(true)

    await expect(flushPending()).resolves.toMatchObject({ ok: true })
    expect(api.requests('DELETE')).toHaveLength(1)
    expect(await localTasks()).toHaveLength(0)
    expect(notify.error).not.toHaveBeenCalled()
  })

  it('backs off and keeps the queue after a network failure, then recovers', async () => {
    await create('Dentist')
    setOnline(true)
    api.fail({ method: 'POST', mode: 'network' })

    await expect(flushPending()).resolves.toEqual({ ok: false, reason: 'error' })
    expect(getSyncState()).toMatchObject({ reachable: false, online: false, lastResult: { type: 'network' } })
    expect(getSyncState().pending).toBe(1)
    expect(api.live).toHaveLength(0)

    await expect(flushPending()).resolves.toMatchObject({ ok: true })
    expect(getSyncState()).toMatchObject({ reachable: true, online: true, pending: 0 })
    expect(api.live).toHaveLength(1)
  })

  it('keeps retrying server errors (5xx) instead of discarding the change', async () => {
    await create('Dentist')
    setOnline(true)
    api.fail({ method: 'POST', mode: 'status', status: 503 })

    await flushPending()
    expect(getSyncState().lastResult.type).toBe('error')
    expect((await localTasks())[0].needsSync).toBe(true)
    expect(notify.error).not.toHaveBeenCalled()

    await expect(flushPending()).resolves.toMatchObject({ ok: true })
    expect(api.live).toHaveLength(1)
  })

  it('shares one flush between simultaneous callers', async () => {
    await create('Dentist')
    setOnline(true)
    const [a, b] = await Promise.all([flushPending(), flushPending()])
    expect(a).toBe(b)
    expect(api.requests('POST')).toHaveLength(1)
  })
})

describe('revision conflicts', () => {
  it('keeps an edit made while the create was in flight and uploads it in the next pass', async () => {
    const task = await create('Dentist')
    setOnline(true)
    const hold = api.hold('POST')

    const flushing = flushPending()
    await hold.begun // the POST (with the old title) is now in flight
    await editTask(task.id, { title: 'Dentist at 3' }, { silent: true })
    hold.release()
    await flushing

    expect(api.requests('POST')[0].body.title).toBe('Dentist')
    expect(api.requests('PUT')).toHaveLength(1)
    expect(api.requests('PUT')[0].path).toBe(`/tasks/${api.live[0].id}`)
    expect(api.live[0].title).toBe('Dentist at 3')

    const [stored] = await localTasks()
    expect(stored).toMatchObject({ id: api.live[0].id, title: 'Dentist at 3', needsSync: false })
  })

  it('keeps a completion made while a previous one was uploading', async () => {
    const seeded = api.seed({ title: 'Stretch', status: 'pending' })
    await pullFromServer()
    await setTaskStatus(seeded.id, 'completed', { silent: true })
    setOnline(true)
    const hold = api.hold('PATCH')

    const flushing = flushPending()
    await hold.begun
    await setTaskStatus(seeded.id, 'pending', { silent: true }) // re-opened while the first PATCH is in flight
    hold.release()
    await flushing

    expect(api.requests('PATCH').map((r) => r.body.status)).toEqual(['completed', 'pending'])
    expect(api.get(seeded.id).status).toBe('pending')
    expect((await getTask(seeded.id)).needsSync).toBe(false)
  })

  it('never overwrites a local change that is still waiting when a pull arrives', async () => {
    const seeded = api.seed({ title: 'Original' })
    await pullFromServer()
    await editTask(seeded.id, { title: 'My offline edit' }, { silent: true })
    api.change(seeded.id, { title: 'Their edit' })

    await pullFromServer()
    expect((await getTask(seeded.id)).title).toBe('My offline edit')
    expect((await getTask(seeded.id)).needsSync).toBe(true)
  })

  it('lets the next pull restore the server version after an edit is rejected', async () => {
    const seeded = api.seed({ title: 'Original' })
    await pullFromServer()
    await editTask(seeded.id, { title: 'x' }, { silent: true })
    setOnline(true)
    api.fail({ method: 'PUT', mode: 'status', status: 422, detail: 'Title is too short' })

    await expect(flushPending()).resolves.toMatchObject({ ok: true })
    expect(notify.error).toHaveBeenCalledTimes(1)
    expect(notify.error.mock.calls[0][0]).toMatch(/rejected/)
    const stored = await getTask(seeded.id)
    expect(stored).toMatchObject({ title: 'Original', needsSync: false })
    expect(api.requests('PUT')).toHaveLength(1) // not retried forever
  })

  it('drops a create the server refuses for good and says why', async () => {
    await create('')
    setOnline(true)
    api.fail({ method: 'POST', mode: 'status', status: 422, detail: 'Title is required' })

    await expect(flushPending()).resolves.toMatchObject({ ok: true })
    expect(await localTasks()).toHaveLength(0)
    expect(notify.error).toHaveBeenCalledTimes(1)
    expect(api.requests('POST')).toHaveLength(1)
  })

  it('removes a reminder locally when an edit hits a task that no longer exists (404)', async () => {
    const seeded = api.seed({ title: 'Doomed' })
    await pullFromServer()
    await editTask(seeded.id, { title: 'Doomed v2' }, { silent: true })
    api.remove(seeded.id)
    setOnline(true)

    await flushPending()
    expect(await localTasks()).toHaveLength(0)
  })
})

describe('pulling changes', () => {
  it('downloads a snapshot first, then only changes after the stored cursor', async () => {
    const a = api.seed({ title: 'A' })
    api.seed({ title: 'B' })
    await pullFromServer()

    expect(api.requests('GET')[0].query.cursor).toBeUndefined()
    expect(await titles()).toEqual(['A', 'B'])
    const cursor = await getMeta('syncCursor')
    expect(cursor).toMatch(/^d\./)

    api.change(a.id, { title: 'A2' })
    api.seed({ title: 'C' })
    api.clearLog()
    await pullFromServer()

    expect(api.requests('GET')).toHaveLength(1)
    expect(api.requests('GET')[0].query.cursor).toBe(cursor)
    expect(await titles()).toEqual(['A2', 'B', 'C'])
  })

  it('applies tombstones so a reminder deleted on another device disappears', async () => {
    api.seed({ title: 'Keep' })
    const gone = api.seed({ title: 'Remove' })
    await pullFromServer()
    api.remove(gone.id)
    await pullFromServer()
    expect(await titles()).toEqual(['Keep'])
  })

  it('walks every page of a large snapshot', async () => {
    for (let i = 0; i < 205; i++) api.seed({ title: `Task ${i}` })
    await pullFromServer()
    expect(api.requests('GET')).toHaveLength(2)
    expect((await getAllTasks()).length).toBe(205)
  })

  it('discards the cursor and re-downloads a snapshot when the server says it is too old (410)', async () => {
    api.seed({ title: 'Stays' })
    const gone = api.seed({ title: 'Deleted while away' })
    await pullFromServer()
    api.remove(gone.id)
    api.seed({ title: 'Added while away' })
    api.expireCursors()
    api.clearLog()

    await pullFromServer()

    const gets = api.requests('GET')
    expect(gets).toHaveLength(2)
    expect(gets[0].query.cursor).toBeDefined() // rejected with 410
    expect(gets[1].query.cursor).toBeUndefined() // full snapshot
    expect(await titles()).toEqual(['Added while away', 'Stays'])
  })

  it('prunes synced reminders a snapshot no longer mentions, but keeps unsent local ones', async () => {
    const vanished = api.seed({ title: 'Vanished' })
    api.seed({ title: 'Still there' })
    await pullFromServer()
    await create('Unsent')
    api.remove(vanished.id)

    await pullFromServer({ full: true })
    expect(await titles()).toEqual(['Still there', 'Unsent'])
  })

  it('leaves the cursor alone when a pull fails, so the next one repeats the same range', async () => {
    api.seed({ title: 'A' })
    await pullFromServer()
    const cursor = await getMeta('syncCursor')
    api.fail({ method: 'GET', mode: 'status', status: 500 })
    await expect(pullFromServer()).rejects.toBeTruthy()
    expect(await getMeta('syncCursor')).toBe(cursor)
  })

  it('syncNow pulls when idle and respects the 20 s throttle unless forced', async () => {
    setOnline(true)
    api.seed({ title: 'A' })
    await syncNow()
    expect(api.requests('GET')).toHaveLength(1)
    await syncNow()
    expect(api.requests('GET')).toHaveLength(1)
    await syncNow({ force: true })
    expect(api.requests('GET')).toHaveLength(2)
  })

  it('syncNow uploads pending changes instead of pulling first', async () => {
    await create('Queued')
    setOnline(true)
    await syncNow()
    const methods = api.log.map((r) => r.method)
    expect(methods[0]).toBe('POST')
    expect(methods.at(-1)).toBe('GET')
  })
})
