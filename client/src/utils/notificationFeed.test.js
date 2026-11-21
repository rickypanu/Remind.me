import { describe, expect, it } from 'vitest';
import { buildFeed, lastSundayEvening, unreadCount } from './notificationFeed';

const at = (s) => Date.parse(s);
const task = (id, due, extra = {}) => ({ id, title: id, status: 'pending', schedule_type: 'once', due_date: due, ...extra });

describe('lastSundayEvening', () => {
  it('is the Sunday 8 pm IST that last passed', () => {
    expect(new Date(lastSundayEvening(at('2026-11-16T10:00:00+05:30'))).toISOString()).toBe('2026-11-15T14:30:00.000Z');
    expect(new Date(lastSundayEvening(at('2026-11-15T21:00:00+05:30'))).toISOString()).toBe('2026-11-15T14:30:00.000Z');
    expect(new Date(lastSundayEvening(at('2026-11-15T12:00:00+05:30'))).toISOString()).toBe('2026-11-08T14:30:00.000Z');
  });
});

describe('buildFeed', () => {
  const now = at('2026-11-16T10:00:00+05:30');
  it('has the weekly summary, a due-soon item and missed items, newest first', () => {
    const feed = buildFeed([task('a', '2026-11-16T10:30:00+05:30'), task('b', '2026-11-16T08:00:00+05:30'), task('c', '2026-11-18T09:00:00+05:30'), task('d', '2026-11-16T09:00:00+05:30', { status: 'completed' })], now);
    expect(feed.map((x) => x.kind)).toEqual(['soon', 'missed', 'week']);
    expect(feed[2]).toMatchObject({ week: 3, overdue: 0 });
  });
  it('ignores deleted and repeating reminders', () => {
    const feed = buildFeed([task('a', '2026-11-16T10:30:00+05:30', { deleted: true }), task('b', '2026-11-16T10:30:00+05:30', { schedule_type: 'daily' })], now);
    expect(feed.map((x) => x.kind)).toEqual(['week']);
  });
  it('counts unread items by id', () => {
    const feed = buildFeed([task('a', '2026-11-16T10:30:00+05:30')], now);
    expect(unreadCount(feed, new Set())).toBe(2);
    expect(unreadCount(feed, new Set(feed.map((x) => x.id)))).toBe(0);
  });
});
