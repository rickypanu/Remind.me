// The website's notification feed (the bell). It is built on this device from the reminders in the offline store, so it
// works offline and needs no server job. Pure functions, easy to test.
import { istDateKey } from './date';

const IST = 330 * 60 * 1000;
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;

/** The latest Sunday 8 pm IST that has already passed (the moment this week's summary "arrived"). */
export function lastSundayEvening(nowMs = Date.now()) {
  const ist = new Date(nowMs + IST);
  const back = ist.getUTCDay(); // days since Sunday
  let at = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back, 20, 0) - IST;
  if (at > nowMs) at -= 7 * DAY;
  return at;
}

const live = (t) => t && !t.deleted && t.status !== 'completed' && t.syncAction !== 'delete';

/** Numbers behind the Sunday summary, counted from the moment it arrived. */
export function weeklySummary(tasks, at) {
  const end = at + 7 * DAY;
  let week = 0;
  let overdue = 0;
  for (const x of tasks) {
    if (!live(x) || x.schedule_type !== 'once' || !x.due_date) continue;
    const due = Date.parse(x.due_date);
    if (!Number.isFinite(due)) continue;
    if (due < at) overdue += 1;
    else if (due <= end) week += 1;
  }
  return { week, overdue };
}

/**
 * Items newest first: { id, kind: 'week' | 'soon' | 'missed', title, body, at, taskId? }.
 * - week: the Sunday 8 pm summary, kept for 7 days
 * - soon: a reminder due within the next hour
 * - missed: pending reminders that went past in the last 3 days (at most 5)
 */
export function buildFeed(tasks, nowMs = Date.now()) {
  const items = [];
  const at = lastSundayEvening(nowMs);
  if (nowMs - at < 7 * DAY) {
    const { week, overdue } = weeklySummary(tasks, at);
    const parts = [`${week} due this coming week`];
    if (overdue) parts.push(`${overdue} overdue`);
    items.push({ id: `week-${istDateKey(at)}`, kind: 'week', title: 'Your week ahead', body: `${parts.join(', ')}.`, at, week, overdue });
  }
  const missed = [];
  for (const x of tasks) {
    if (!live(x) || !x.due_date) continue;
    const due = Date.parse(x.due_date);
    if (!Number.isFinite(due)) continue;
    const id = x.id || x.clientId;
    if (x.schedule_type === 'once' && due > nowMs && due - nowMs <= 60 * MIN) {
      items.push({ id: `soon-${id}-${due}`, kind: 'soon', title: x.title, body: `Due in ${Math.max(1, Math.round((due - nowMs) / MIN))} min`, mins: Math.max(1, Math.round((due - nowMs) / MIN)), at: due - 60 * MIN, taskId: id });
    } else if (x.schedule_type === 'once' && due <= nowMs && nowMs - due <= 3 * DAY) {
      missed.push({ id: `missed-${id}-${due}`, kind: 'missed', title: x.title, body: 'You missed this one', at: due, taskId: id });
    }
  }
  missed.sort((a, b) => b.at - a.at);
  items.push(...missed.slice(0, 5));
  return items.sort((a, b) => b.at - a.at);
}

export function unreadCount(items, seen) {
  return items.reduce((n, x) => n + (seen.has(x.id) ? 0 : 1), 0);
}
