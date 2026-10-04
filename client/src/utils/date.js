// One shared parser so Dashboard and TaskCard always agree on what "due" means.
// If the backend sends a naive timestamp (no timezone), it is treated as UTC.
// If your backend stores local time instead, remove the "Z" fallback below.
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