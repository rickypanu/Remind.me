// ---------------------------------------------------------------------------
// App timezone = IST (UTC+05:30, no daylight saving, so a fixed offset is exact).
// The database stores UTC. Everything the user SEES or FILTERS ("today",
// "upcoming", overdue, the date picker) is computed in IST, independent of
// the device's own timezone setting - this matches the server's reminders.
// ---------------------------------------------------------------------------
export const APP_TIMEZONE = 'Asia/Kolkata';
const IST_OFFSET_MS = 330 * 60 * 1000; // +05:30
const DAY_MS = 24 * 60 * 60 * 1000;

// [start, end] of the IST calendar day that contains `nowMs`, as UTC epoch ms.
export function getIstDayRange(nowMs = Date.now()) {
  const shifted = nowMs + IST_OFFSET_MS;
  const start = Math.floor(shifted / DAY_MS) * DAY_MS - IST_OFFSET_MS;
  return { start, end: start + DAY_MS - 1 };
}

// Current hour (0-23) in IST - used for the greeting.
export function getIstHour(nowMs = Date.now()) {
  return new Date(nowMs + IST_OFFSET_MS).getUTCHours();
}

// "YYYY-MM-DDTHH:mm" for <input type="datetime-local" min=...>, expressed in IST.
export function getIstNowInputValue(nowMs = Date.now()) {
  return new Date(nowMs + IST_OFFSET_MS).toISOString().slice(0, 16);
}

// datetime-local value (typed as IST wall-clock time) -> UTC ISO string for the API.
export function istInputToUtcIso(value) {
  const d = new Date(`${value}:00+05:30`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// Human readable due time, always in IST. e.g. "8 Oct, 5:00 pm"
export function formatDueIst(value) {
  const date = parseDueDate(value);
  if (!date) return '';
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: APP_TIMEZONE,
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

// One shared parser so Dashboard and TaskCard always agree on what "due" means.
// The backend sends IST timestamps with an explicit offset ("2026-10-24T21:30:00+05:30"); older responses carried
// UTC with a "Z". Both are exact instants. A legacy value with no timezone at all is treated as UTC (that is how
// MongoDB stores it).
export function parseDueDate(value) {
  if (!value) return null;
  const str = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(str);
  const date = new Date(hasZone ? str : `${str}Z`);
  return isNaN(date.getTime()) ? null : date;
}

// ---------------------------------------------------------------------------
// IST calendar days as "YYYY-MM-DD" keys (what <input type="date"> produces, and what the calendar filter and the
// "Upcoming" groups are keyed by). Keys are plain text, so they mean the same on every device.
// ---------------------------------------------------------------------------
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

/** The IST calendar day containing `ms`, e.g. "2026-10-24". */
export function istDateKey(ms = Date.now()) {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** [start, end] (UTC epoch ms) of the IST day named by a "YYYY-MM-DD" key, or null if the key is not a real date. */
export function istDayRangeFromKey(key) {
  if (!DAY_KEY.test(String(key || ''))) return null;
  const start = Date.parse(`${key}T00:00:00+05:30`);
  if (Number.isNaN(start) || istDateKey(start) !== key) return null; // rejects 2026-02-31 and the like
  return { start, end: start + DAY_MS - 1 };
}

/** "Today", "Tomorrow", "Yesterday", otherwise "Mon, 26 Oct" (adds the year when it is not the current one). */
export function formatIstDayLabel(key, nowMs = Date.now()) {
  const range = istDayRangeFromKey(key);
  if (!range) return '';
  const diff = Math.round((range.start - getIstDayRange(nowMs).start) / DAY_MS);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: APP_TIMEZONE, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    }).formatToParts(new Date(range.start + 12 * 60 * 60 * 1000)).map((p) => [p.type, p.value]),
  );
  const sameYear = key.slice(0, 4) === istDateKey(nowMs).slice(0, 4);
  return `${parts.weekday}, ${parts.day} ${parts.month}${sameYear ? '' : ` ${parts.year}`}`;
}

export function getRelativeTime(value) {
  const date = parseDueDate(value);
  if (!date) return '';

  const diffMins = Math.trunc((date - new Date()) / 60000);
  const diffHours = Math.trunc(diffMins / 60);
  const diffDays = Math.trunc(diffHours / 24);

  if (diffDays > 0) return `Due in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  if (diffDays < 0) return `Overdue by ${Math.abs(diffDays)} day${diffDays < -1 ? 's' : ''}`;
  if (diffHours > 0) return `Due in ${diffHours} hr${diffHours > 1 ? 's' : ''}`;
  if (diffHours < 0) return `Overdue by ${Math.abs(diffHours)} hr${diffHours < -1 ? 's' : ''}`;
  if (diffMins > 0) return `Due in ${diffMins} min`;
  if (diffMins < 0) return `Overdue by ${Math.abs(diffMins)} min`;
  return 'Due now';
}

// ---------------------------------------------------------------------------
// Offline helpers: the server normally works these out, but while offline the
// app must show a sensible due date / label immediately (the server's values
// replace them after the next sync).
// ---------------------------------------------------------------------------
const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Next daily/weekly occurrence (UTC ISO string) strictly after `afterMs`, or null if the series has ended. */
export function nextOccurrenceIso(type, timeOfDay, weekdays = [], afterMs = Date.now(), endsOn = null) {
  const [h, m] = String(timeOfDay || '09:00').split(':').map(Number);
  const todayStart = getIstDayRange(afterMs).start; // IST midnight of the day containing afterMs
  for (let i = 0; i <= 8; i++) {
    const dayStart = todayStart + i * DAY_MS;
    const candidate = dayStart + (h * 60 + m) * 60000;
    if (candidate <= afterMs) continue;
    const shifted = new Date(dayStart + IST_OFFSET_MS);
    if (type === 'weekly') {
      const weekday = (shifted.getUTCDay() + 6) % 7; // 0 = Monday ... 6 = Sunday (same as the API)
      if (!weekdays.includes(weekday)) continue;
    }
    if (endsOn && shifted.toISOString().slice(0, 10) > endsOn) return null;
    return new Date(candidate).toISOString();
  }
  return null;
}

/** Same wording as the server's describe_schedule(), e.g. "Every Mon, Wed at 6:30 PM". */
export function describeScheduleLocal(type, timeOfDay, weekdays = []) {
  if ((type !== 'daily' && type !== 'weekly') || !timeOfDay) return 'One time';
  const [h, m] = timeOfDay.split(':').map(Number);
  const stamp = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
  const days = [...new Set(weekdays)].sort();
  if (type === 'daily' || days.length === 7) return `Every day at ${stamp}`;
  return `Every ${days.map((d) => WEEKDAY_SHORT[d]).join(', ')} at ${stamp}`;
}

/** UTC ISO / Date string -> "YYYY-MM-DDTHH:mm" in IST, for <input type="datetime-local">. */
export function utcToIstInput(value) {
  const date = parseDueDate(value);
  return date ? new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16) : '';
}
