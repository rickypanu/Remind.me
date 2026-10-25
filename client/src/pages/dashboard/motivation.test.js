import { describe, expect, it } from 'vitest'
import { CLASSIC_QUOTES, RELATABLE_LINES } from '../../data/quotes.data'
import { buildMotivation, effectiveStreak, hashString, pickSituation, timeOfDay } from './motivation'

const base = { name: 'Ricky Panu', userId: 'u1', dayKey: '2026-10-24', hour: 10, streak: null, bestStreak: 0, doneToday: 0, pendingToday: 3, overdue: 0 }
const build = (over = {}, shuffle = 0) => buildMotivation({ ...base, ...over }, shuffle)

describe('quote library', () => {
  it('every quote has text and valid themes; classics have an author', () => {
    const themes = new Set(['start', 'focus', 'persist', 'comeback', 'consistency', 'rest', 'courage', 'joy'])
    for (const item of [...CLASSIC_QUOTES, ...RELATABLE_LINES]) {
      expect(item.text.length).toBeGreaterThan(10)
      expect(item.text.length).toBeLessThan(160)
      expect(item.themes.length).toBeGreaterThan(0)
      expect(item.themes.every((t) => themes.has(t))).toBe(true)
    }
    for (const q of CLASSIC_QUOTES) expect(q.author.length).toBeGreaterThan(2)
  })

  it('has no duplicate lines', () => {
    const texts = [...CLASSIC_QUOTES, ...RELATABLE_LINES].map((q) => q.text)
    expect(new Set(texts).size).toBe(texts.length)
  })

  it('has athletes, leaders and thinkers, and lines with no author', () => {
    expect(CLASSIC_QUOTES.length).toBeGreaterThanOrEqual(30)
    expect(RELATABLE_LINES.length).toBeGreaterThanOrEqual(10)
  })

  it('every situation can find at least one quote of each kind', () => {
    for (const situation of ['allDone', 'streak', 'streakAtRisk', 'overdue', 'progress', 'restart', 'empty', 'morning', 'afternoon', 'evening', 'night']) {
      const kinds = new Set()
      for (let shuffle = 0; shuffle < 12; shuffle++) {
        const ctx = {
          allDone: { doneToday: 2, pendingToday: 0 },
          streak: { streak: 4, doneToday: 1 },
          streakAtRisk: { streak: 4 },
          overdue: { overdue: 2 },
          progress: { doneToday: 1 },
          restart: { streak: 0, bestStreak: 5 },
          empty: { pendingToday: 0 },
          morning: { hour: 9 }, afternoon: { hour: 14 }, evening: { hour: 19 }, night: { hour: 23 },
        }[situation]
        const out = build(ctx, shuffle)
        expect(out.situation).toBe(situation)
        expect(out.quote.text).toBeTruthy()
        kinds.add(out.quote.kind)
      }
      expect(kinds.size).toBe(2)
    }
  })
})

describe('situation', () => {
  it('everything done today beats everything else', () => {
    expect(pickSituation({ ...base, doneToday: 2, pendingToday: 0, overdue: 5, streak: 9 })).toBe('allDone')
  })
  it('a live streak with a completion today celebrates the streak', () => {
    expect(pickSituation({ ...base, streak: 3, doneToday: 1 })).toBe('streak')
  })
  it('a streak that needs today\'s tick is "at risk"', () => {
    expect(pickSituation({ ...base, streak: 3, doneToday: 0 })).toBe('streakAtRisk')
  })
  it('overdue work is met with a comeback message', () => {
    expect(pickSituation({ ...base, overdue: 2 })).toBe('overdue')
  })
  it('a broken streak with a good past invites a restart', () => {
    expect(pickSituation({ ...base, streak: 0, bestStreak: 6 })).toBe('restart')
  })
  it('works without server stats (streak unknown)', () => {
    expect(pickSituation({ ...base, streak: null, bestStreak: 0 })).toBe('morning')
  })
  it('time of day boundaries', () => {
    expect([4, 5, 11, 12, 17, 18, 21, 22].map(timeOfDay)).toEqual(['night', 'morning', 'morning', 'afternoon', 'afternoon', 'evening', 'evening', 'night'])
  })
})

describe('headline is personal', () => {
  it('uses the first name and the streak', () => {
    const { headline } = build({ streak: 9, doneToday: 1 })
    expect(headline).toContain('Ricky')
    expect(headline).not.toContain('Panu')
    expect(headline).toContain('9')
  })
  it('names the best streak on a restart', () => {
    expect(build({ streak: 0, bestStreak: 6 }).headline).toContain('6')
  })
  it('reports done and left today', () => {
    const { headline } = build({ doneToday: 2, pendingToday: 3 })
    expect(headline).toContain('2')
    expect(headline).toContain('3')
  })
  it('with no name it leaves the name out cleanly and never prints a raw placeholder', () => {
    for (const over of [{ name: '' }, { name: undefined }, { streak: 5, doneToday: 1 }, { overdue: 1 }, { pendingToday: 0 }]) {
      const { headline } = build(over)
      expect(headline).not.toMatch(/[{}]|undefined|NaN|null/)
    }
    for (let i = 0; i < 20; i++) {
      const { headline } = build({ name: '', userId: `u${i}`, overdue: i % 2, streak: i % 3 === 0 ? 4 : null, doneToday: i % 4 })
      expect(headline).not.toMatch(/, there|,\s*[.!]|\s{2}/)
    }
  })
})

describe('stability and shuffling', () => {
  it('is the same for the same user, day and situation', () => {
    expect(build()).toEqual(build())
  })
  it('differs between users and days (most of the time)', () => {
    const users = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map((id) => build({ userId: id }).quote.text))
    expect(users.size).toBeGreaterThan(1)
    const days = new Set(Array.from({ length: 8 }, (_, i) => build({ dayKey: `2026-10-${10 + i}` }).quote.text))
    expect(days.size).toBeGreaterThan(1)
  })
  it('shuffle gives other quotes but keeps the headline', () => {
    const first = build({}, 0)
    const texts = new Set(Array.from({ length: 10 }, (_, i) => build({}, i).quote.text))
    expect(texts.size).toBeGreaterThan(3)
    expect(build({}, 5).headline).toBe(first.headline)
  })
  it('hash is stable and 32-bit', () => {
    expect(hashString('abc')).toBe(hashString('abc'))
    expect(hashString('abc')).not.toBe(hashString('abd'))
    expect(hashString('x')).toBeLessThan(2 ** 32)
  })
})

describe('effectiveStreak', () => {
  it('adds the completion the server has not received yet', () => {
    expect(effectiveStreak({ streak: 3, completed_today: 0 }, 1)).toBe(4)
  })
  it('does not double count once the server has it', () => {
    expect(effectiveStreak({ streak: 4, completed_today: 1 }, 1)).toBe(4)
  })
  it('is null (unknown) without stats', () => {
    expect(effectiveStreak(undefined, 2)).toBeNull()
    expect(effectiveStreak({}, 2)).toBeNull()
  })
})
