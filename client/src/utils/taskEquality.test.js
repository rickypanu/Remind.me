import { describe, expect, it } from 'vitest'
import { sameTask } from './taskEquality'

const t = { id: '1', rev: 2, status: 'pending', title: 'A', due_date: 'x', needsSync: false, updated_at: 'u' }

describe('sameTask', () => {
  it('treats fresh copies with the same content as equal', () => {
    expect(sameTask(t, { ...t })).toBe(true)
  })
  it('notices every change a card shows', () => {
    for (const change of [{ rev: 3 }, { status: 'completed' }, { title: 'B' }, { due_date: 'y' }, { needsSync: true }, { updated_at: 'v' }]) {
      expect(sameTask(t, { ...t, ...change })).toBe(false)
    }
  })
  it('handles missing tasks', () => {
    expect(sameTask(t, null)).toBe(false)
    expect(sameTask(null, null)).toBe(true)
  })
})
