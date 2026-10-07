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