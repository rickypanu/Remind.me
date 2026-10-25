import { http, HttpResponse } from 'msw'

/**
 * A small in-memory model of the reminders API (POST/PUT/PATCH/DELETE + the delta feed GET /v1/tasks), exposed as
 * MSW handlers. It reproduces the behaviours the sync engine depends on:
 *   - a create with a known client_id returns the stored reminder (idempotent),
 *   - deleting leaves a tombstone, a second delete is 404,
 *   - GET /tasks is a snapshot without a cursor and a delta (>= cursor, so recent changes repeat) with one,
 *   - a cursor can be declared expired (410 full_resync_required).
 * and lets a test inject faults and hold a response back:
 *   server.fail({ method: 'POST', mode: 'network' | 'lose-response' | 'status', status: 503, times: 1 })
 *   const release = server.hold('POST')      // the next POST waits until release() is called
 */
export const BASE = 'http://localhost:8000/v1'

export function createFakeTaskServer() {
  const tasks = new Map() // id -> document (live or tombstone)
  const log = [] // [{ method, path, body, query }]
  const faults = []
  const holds = []
  let clock = Date.parse('2026-01-01T00:00:00Z')
  let nextId = 1
  let cursorsExpired = false

  const tick = () => (clock += 1)
  const iso = (ms) => new Date(ms).toISOString()

  const view = (doc) => ({ ...doc, updated_at: iso(doc.updated_ms), created_at: iso(doc.created_ms) })

  const touch = (doc, patch = {}) => {
    Object.assign(doc, patch, { updated_ms: tick() })
    return doc
  }

  async function intercept(request, method, process) {
    const query = Object.fromEntries(new URL(request.url).searchParams)
    const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await request.clone().json().catch(() => null) : null
    log.push({ method, path: new URL(request.url).pathname.replace('/v1', ''), body, query })

    const holdIndex = holds.findIndex((h) => h.method === method)
    if (holdIndex !== -1) {
      const [hold] = holds.splice(holdIndex, 1)
      hold.started()
      await hold.gate
    }

    const faultIndex = faults.findIndex((f) => f.method === method && f.times > 0)
    const fault = faultIndex === -1 ? null : faults[faultIndex]
    if (fault) fault.times -= 1
    if (fault?.mode === 'network') return HttpResponse.error()
    if (fault?.mode === 'status') return HttpResponse.json({ detail: fault.detail || 'Injected failure' }, { status: fault.status })

    const response = process(body, query)
    return fault?.mode === 'lose-response' ? HttpResponse.error() : response
  }

  const notFound = () => HttpResponse.json({ detail: 'Task not found' }, { status: 404 })
  const live = (id) => {
    const doc = tasks.get(id)
    return doc && !doc.deleted ? doc : null
  }

  const handlers = [
    http.post(`${BASE}/tasks`, ({ request }) =>
      intercept(request, 'POST', (body) => {
        const existing = [...tasks.values()].find((t) => !t.deleted && body.client_id && t.client_id === body.client_id)
        if (existing) return HttpResponse.json(view(existing), { status: 201 })
        const now = tick()
        const doc = {
          id: `srv_${nextId++}`,
          weekdays: [],
          description: null,
          completed_count: 0,
          ...body,
          created_ms: now,
          updated_ms: now,
          deleted: false,
        }
        tasks.set(doc.id, doc)
        return HttpResponse.json(view(doc), { status: 201 })
      }),
    ),

    http.put(`${BASE}/tasks/:id`, ({ request, params }) =>
      intercept(request, 'PUT', (body) => {
        const doc = live(params.id)
        return doc ? HttpResponse.json(view(touch(doc, body))) : notFound()
      }),
    ),

    http.patch(`${BASE}/tasks/:id`, ({ request, params }) =>
      intercept(request, 'PATCH', (body) => {
        const doc = live(params.id)
        return doc ? HttpResponse.json(view(touch(doc, { status: body.status }))) : notFound()
      }),
    ),

    http.delete(`${BASE}/tasks/:id`, ({ request, params }) =>
      intercept(request, 'DELETE', () => {
        const doc = live(params.id)
        if (!doc) return notFound()
        touch(doc, { deleted: true, deleted_ms: clock })
        return HttpResponse.json({ message: 'Task deleted' })
      }),
    ),

    http.get(`${BASE}/tasks`, ({ request }) =>
      intercept(request, 'GET', (_body, query) => {
        const limit = Number(query.limit) || 200
        // cursor = "<s|d>.<updated_ms>.<id>": s = resume a snapshot, d = delta feed
        let after = null
        let snapshotRun = true
        if (query.cursor) {
          const [flag, ms, id] = query.cursor.split('.')
          after = { ms: Number(ms), id: id || '' }
          snapshotRun = flag === 's'
        }
        if (!snapshotRun && cursorsExpired) {
          return HttpResponse.json({ detail: 'Sync cursor too old', code: 'full_resync_required' }, { status: 410 })
        }
        const rows = [...tasks.values()]
          .filter((t) => (snapshotRun ? !t.deleted : true))
          .sort((a, b) => a.updated_ms - b.updated_ms || (a.id < b.id ? -1 : 1))
          .filter((t) => {
            if (!after) return true
            // snapshot pages resume strictly after the last row; delta feeds repeat the safety window (>=)
            return snapshotRun
              ? t.updated_ms > after.ms || (t.updated_ms === after.ms && t.id > after.id)
              : t.updated_ms >= after.ms
          })
        const page = rows.slice(0, limit)
        const hasMore = rows.length > limit
        const last = page[page.length - 1]
        const nextCursor = hasMore ? `${snapshotRun ? 's' : 'd'}.${last.updated_ms}.${last.id}` : `d.${clock - 5}.`
        return HttpResponse.json({
          items: page.filter((t) => !t.deleted).map(view),
          deleted: page.filter((t) => t.deleted).map((t) => ({ id: t.id, deleted_at: iso(t.deleted_ms), updated_at: iso(t.updated_ms) })),
          next_cursor: nextCursor,
          has_more: hasMore,
          snapshot: snapshotRun,
          server_time: iso(clock),
        })
      }),
    ),
  ]

  return {
    handlers,
    log,
    /** Reminders that exist on the server (tombstones excluded). */
    get live() {
      return [...tasks.values()].filter((t) => !t.deleted)
    },
    get(id) {
      return tasks.get(id)
    },
    requests: (method) => log.filter((entry) => entry.method === method),
    clearLog: () => log.splice(0),
    /** Create a reminder as if it was added from another device. */
    seed(fields = {}) {
      const now = tick()
      const doc = {
        id: `srv_${nextId++}`,
        title: 'Seeded',
        category: 'Personal',
        status: 'pending',
        schedule_type: 'once',
        due_date: '2026-06-01T10:00:00Z',
        weekdays: [],
        description: null,
        completed_count: 0,
        ...fields,
        created_ms: now,
        updated_ms: now,
        deleted: false,
      }
      tasks.set(doc.id, doc)
      return doc
    },
    /** Change or delete as if from another device. */
    change: (id, patch) => touch(tasks.get(id), patch),
    remove: (id) => touch(tasks.get(id), { deleted: true, deleted_ms: clock }),
    expireCursors: (value = true) => {
      cursorsExpired = value
    },
    fail: (fault) => faults.push({ times: 1, ...fault }),
    hold(method) {
      let release
      let started
      const gate = new Promise((resolve) => (release = resolve))
      const begun = new Promise((resolve) => (started = resolve))
      holds.push({ method, gate, started })
      return { release, begun }
    },
  }
}
