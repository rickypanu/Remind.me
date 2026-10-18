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
// The backend now always sends UTC with a "Z". If a legacy value arrives with no
// timezone it is treated as UTC (that is how MongoDB stores it).
export function parseDueDate(value) {
  if (!value) return null;
  const str = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(str);
  const date = new Date(hasZone ? str : `${str}Z`);
  return isNaN(date.getTime()) ? null : date;
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
