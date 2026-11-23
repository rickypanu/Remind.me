// ---------------------------------------------------------------------------
// "Usual times": when someone types "gym" with a clock time twice in a row, the third "gym" with no time
// gets that time instead of a default. Stored on the device only (a small object, at most MAX_HABITS entries):
//
//   { "gym": { h: 6, m: 0, n: 2 }, "call mom": { h: 19, m: 30, n: 3 } }
//
// Pure functions: the caller keeps the object (app: settings.habits, website: localStorage) and passes it to
// parseQuick(text, now, habits). Nothing here is sent to the server.
// ---------------------------------------------------------------------------

export const HABIT_MIN_COUNT = 2; // the same time this many times in a row makes a habit
const MAX_HABITS = 80;
const SKIP = new Set(['to', 'the', 'a', 'an', 'my', 'our', 'with', 'for', 'at', 'on', 'in', 'and', 'of', 'me']);

/** "Call mom tomorrow" -> "call mom": the first two meaningful words of the title. */
export function habitKey(title) {
  const words = String(title || '')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu);
  if (!words) return '';
  return words.filter((w) => !SKIP.has(w)).slice(0, 2).join(' ');
}

/** [hour, minute] the person usually picks for this key, or null until it has happened HABIT_MIN_COUNT times. */
export function habitClock(habits, key) {
  const entry = key && habits ? habits[key] : null;
  if (!entry || entry.n < HABIT_MIN_COUNT) return null;
  return [entry.h, entry.m];
}

/** The clock time of a quick-add payload in IST, as [h, m]. */
function clockOf(payload) {
  if (payload.time_of_day) {
    const [h, m] = payload.time_of_day.split(':').map(Number);
    return [h, m];
  }
  if (payload.due_date) {
    const d = new Date(Date.parse(payload.due_date) + 330 * 60 * 1000);
    return [d.getUTCHours(), d.getUTCMinutes()];
  }
  return null;
}

/**
 * Returns the habits after this quick add (the very same object when nothing was learned). Only a time the person actually said ("found" has "time") teaches anything;
 * a default never does. Same time again: the count goes up. A different time: it starts over at 1.
 */
export function learnHabit(habits, result) {
  if (!result?.payload || !result.found?.includes('time')) return habits;
  const key = habitKey(result.payload.title);
  const at = clockOf(result.payload);
  if (!key || !at) return habits;
  const store = habits || {};
  const old = store[key];
  const next = { ...store };
  delete next[key]; // re-added below, so the newest entries sit last and the oldest drop first
  next[key] = { h: at[0], m: at[1], n: old && old.h === at[0] && old.m === at[1] ? Math.min(old.n + 1, 9) : 1 };
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_HABITS))) delete next[k];
  return next;
}
