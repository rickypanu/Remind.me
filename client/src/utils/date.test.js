import { describe, expect, it } from 'vitest'
import { formatIstDayLabel, getIstDayRange, istDateKey, istDayRangeFromKey, parseDueDate } from './date'

// 2026-10-24 21:30 IST == 16:00 UTC
const NOW = Date.parse('2026-10-24T16:00:00Z')

describe('IST calendar days', () => {
  it('names the IST day of an instant, not the UTC day', () => {
    expect(istDateKey(Date.parse('2026-10-24T18:29:00Z'))).toBe('2026-10-24') // 23:59 IST
    expect(istDateKey(Date.parse('2026-10-24T18:30:00Z'))).toBe('2026-10-25') // 00:00 IST
  })

  it('turns a picked date into that IST day (midnight to 23:59:59.999)', () => {
    const { start, end } = istDayRangeFromKey('2026-10-26')
    expect(new Date(start).toISOString()).toBe('2026-10-25T18:30:00.000Z')
    expect(end - start).toBe(24 * 60 * 60 * 1000 - 1)
  })

  it('agrees with getIstDayRange for today', () => {
    expect(istDayRangeFromKey(istDateKey(NOW))).toEqual(getIstDayRange(NOW))
  })

  it('rejects anything that is not a real date', () => {
    for (const bad of ['', null, undefined, '2026-02-31', '26-10-2026', '2026-13-01', 'tomorrow']) {
      expect(istDayRangeFromKey(bad)).toBeNull()
    }
  })

  it('labels today, tomorrow and yesterday, then weekday + date', () => {
    expect(formatIstDayLabel('2026-10-24', NOW)).toBe('Today')
    expect(formatIstDayLabel('2026-10-25', NOW)).toBe('Tomorrow')
    expect(formatIstDayLabel('2026-10-23', NOW)).toBe('Yesterday')
    expect(formatIstDayLabel('2026-10-27', NOW)).toBe('Tue, 27 Oct')
    expect(formatIstDayLabel('2027-01-05', NOW)).toBe('Tue, 5 Jan 2027')
    expect(formatIstDayLabel('nonsense', NOW)).toBe('')
  })
})

describe('parseDueDate', () => {
  it('reads IST offsets, Z and (legacy) bare values to the same instant', () => {
    const instant = Date.parse('2026-10-24T16:00:00Z')
    expect(parseDueDate('2026-10-24T21:30:00+05:30').getTime()).toBe(instant)
    expect(parseDueDate('2026-10-24T16:00:00Z').getTime()).toBe(instant)
    expect(parseDueDate('2026-10-24T16:00:00').getTime()).toBe(instant) // no zone = UTC
    expect(parseDueDate(null)).toBeNull()
    expect(parseDueDate('garbage')).toBeNull()
  })
})
