import { describe, expect, it, vi } from 'vitest'
import { resolveProfile } from './useMe'

const mine = { id: 'u1', username: 'Ricky' }
const fresh = { id: 'u1', username: 'Ricky P' }
const unauthorized = Object.assign(new Error('401'), { response: { status: 401 } })

function setup(over = {}) {
  const calls = { fetch: 0, saved: [], refreshed: [] }
  const deps = {
    getSaved: async () => mine,
    save: async (p) => void calls.saved.push(p),
    fetchProfile: async () => (calls.fetch++, fresh),
    isOnline: () => true,
    tokenUserId: 'u1',
    onRefreshed: (p) => calls.refreshed.push(p),
    ...over,
  }
  return { deps, calls }
}
const settle = () => new Promise((r) => setTimeout(r, 0))

describe('resolveProfile', () => {
  it('answers at once from the saved copy, even if the server never answers', async () => {
    const { deps } = setup({ fetchProfile: () => new Promise(() => {}) })
    await expect(resolveProfile(deps)).resolves.toBe(mine)
  })

  it('refreshes in the background and reports the new profile', async () => {
    const { deps, calls } = setup()
    await resolveProfile(deps)
    await settle()
    expect(calls.fetch).toBe(1)
    expect(calls.saved).toEqual([fresh])
    expect(calls.refreshed).toEqual([fresh])
  })

  it('a failed background refresh is silent', async () => {
    const { deps, calls } = setup({ fetchProfile: async () => { throw new Error('down') } })
    await expect(resolveProfile(deps)).resolves.toBe(mine)
    await settle()
    expect(calls.refreshed).toEqual([])
  })

  it('does not refresh while offline', async () => {
    const { deps, calls } = setup({ isOnline: () => false })
    await resolveProfile(deps)
    await settle()
    expect(calls.fetch).toBe(0)
  })

  it('never shows a saved copy that belongs to another account; asks the server instead', async () => {
    const { deps, calls } = setup({ getSaved: async () => ({ id: 'someone-else' }), tokenUserId: 'u1' })
    await expect(resolveProfile(deps)).resolves.toBe(fresh)
    expect(calls.fetch).toBe(1)
  })

  it('first sign-in on this device waits for the network', async () => {
    const { deps } = setup({ getSaved: async () => null })
    await expect(resolveProfile(deps)).resolves.toBe(fresh)
  })

  it("never falls back to another account's saved copy, even when the server is down", async () => {
    const { deps } = setup({ getSaved: async () => ({ id: 'other' }), fetchProfile: async () => { throw new Error('down') } })
    await expect(resolveProfile(deps)).rejects.toBeTruthy()
  })

  it('offline with nothing saved is an error', async () => {
    const { deps } = setup({ getSaved: async () => null, isOnline: () => false })
    await expect(resolveProfile(deps)).rejects.toBeTruthy()
  })

  it('a 401 from the first sign-in request is not swallowed', async () => {
    const { deps } = setup({ getSaved: async () => null, fetchProfile: async () => { throw unauthorized } })
    await expect(resolveProfile(deps)).rejects.toBe(unauthorized)
  })

  it('an unreadable token id still allows the saved copy', async () => {
    const { deps } = setup({ tokenUserId: null })
    await expect(resolveProfile(deps)).resolves.toBe(mine)
  })

  it('a broken local database is treated as nothing saved', async () => {
    const { deps } = setup({ getSaved: async () => { throw new Error('idb blocked') } })
    await expect(resolveProfile(deps)).resolves.toBe(fresh)
  })
})
