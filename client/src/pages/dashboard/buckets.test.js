import { describe, expect, it } from 'vitest'
import { getIstDayRange } from '../../utils/date'
import { bucketTasks, filterByIstDate, groupByIstDay, sortByDue } from './buckets'

// Saturday 24 Oct 2026, 10:00 IST
const NOW = Date.parse('2026-10-24T04:30:00Z')
const range = getIstDayRange(NOW)
const at = (iso) => `${iso}+05:30`
const task = (id, due, extra = {}) => ({ id, title: id, status: 'pending', due_date: due ? at(due) : null, ...extra })
const ids = (list) => list.map((t) => t.id)

describe('bucketTasks', () => {
  const tasks = [
    task('missed', '2026-10-23T09:00:00'),
    task('today-late', '2026-10-24T20:00:00'),
    task('today-early', '2026-10-24T11:00:00'),
    task('up-d3', '2026-10-27T09:00:00'),
    task('up-d1', '2026-10-25T18:00:00'),
    task('up-d2', '2026-10-26T08:00:00'),
    task('undated', null),
    task('done', '2026-10-24T08:00:00', { status: 'completed' }),
  ]

  it('splits into missed / today / upcoming / completed', () => {
    const out = bucketTasks(tasks, range)
    expect(ids(out.missed)).toEqual(['missed'])
    expect(ids(out.today).sort()).toEqual(['today-early', 'today-late'])
    expect(ids(out.completed)).toEqual(['done'])
    expect(out.doneToday).toBe(1)
  })

  it('returns upcoming nearest day first, tomorrow first, undated last', () => {
    expect(ids(bucketTasks(tasks, range).upcoming)).toEqual(['up-d1', 'up-d2', 'up-d3', 'undated'])
  })
})

describe('groupByIstDay', () => {
  it('makes one group per IST day in calendar order, labelled Tomorrow first', () => {
    const groups = groupByIstDay(
      [
        task('c', '2026-10-27T09:00:00'),
        task('a2', '2026-10-25T18:00:00'),
        task('a1', '2026-10-25T07:30:00'),
        task('b', '2026-10-26T08:00:00'),
        task('n', null),
      ],
      NOW
    )
    expect(groups.map((g) => g.label)).toEqual(['Tomorrow', 'Mon, 26 Oct', 'Tue, 27 Oct', 'No date'])
    expect(groups.map((g) => ids(g.tasks))).toEqual([['a1', 'a2'], ['b'], ['c'], ['n']])
  })

  it('skips empty days: if nothing is due tomorrow the first group is the next day with something', () => {
    const groups = groupByIstDay([task('x', '2026-10-28T09:00:00')], NOW)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Wed, 28 Oct')
  })

  it('files a 11:30 PM IST reminder under its IST day, not the UTC one', () => {
    const [group] = groupByIstDay([task('late', '2026-10-25T23:30:00')], NOW)
    expect(group.key).toBe('2026-10-25')
  })

  it('handles an empty list', () => {
    expect(groupByIstDay([], NOW)).toEqual([])
  })
})

describe('filterByIstDate', () => {
  const tasks = [
    task('p2', '2026-10-26T18:00:00'),
    task('p1', '2026-10-26T08:00:00'),
    task('d1', '2026-10-26T07:00:00', { status: 'completed' }),
    task('other', '2026-10-27T08:00:00'),
    task('edge-start', '2026-10-26T00:00:00'),
    task('edge-end', '2026-10-26T23:59:59'),
    task('undated', null),
  ]

  it('keeps only that IST day: pending first in time order, then completed', () => {
    expect(ids(filterByIstDate(tasks, '2026-10-26'))).toEqual(['edge-start', 'p1', 'p2', 'edge-end', 'd1'])
  })

  it('returns nothing for a quiet day or an invalid key', () => {
    expect(filterByIstDate(tasks, '2026-11-30')).toEqual([])
    expect(filterByIstDate(tasks, 'nope')).toEqual([])
  })

  it('includes past days too (so you can look back)', () => {
    expect(ids(filterByIstDate([task('old', '2026-10-01T09:00:00')], '2026-10-01'))).toEqual(['old'])
  })
})

describe('sortByDue', () => {
  it('does not mutate its input', () => {
    const input = [task('b', '2026-10-25T10:00:00'), task('a', '2026-10-25T09:00:00')]
    sortByDue(input)
    expect(ids(input)).toEqual(['b', 'a'])
  })
})
