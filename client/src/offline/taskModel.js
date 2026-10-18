import { describeScheduleLocal, nextOccurrenceIso } from '../utils/date';

/**
 * Pure functions: (task, change) -> new task. No storage, no network, no React.
 * The hook runs them immediately for the optimistic UI and the store then saves the result.
 */
export const isLocalId = (id) => String(id).startsWith('local_');
export const isRecurring = (t) => t.schedule_type === 'daily' || t.schedule_type === 'weekly';

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

export function buildNewTask(payload, userId, now = Date.now()) {
  const type = payload.schedule_type || 'once';
  const weekdays = type === 'weekly' ? payload.weekdays || [] : [];
  const recurring = type !== 'once';
  return {
    id: `local_${newId()}`,
    clientId: newId(),
    user_id: userId || null,
    title: payload.title,
    description: payload.description || null,
    category: payload.category,
    status: 'pending',
    schedule_type: type,
    time_of_day: recurring ? payload.time_of_day : null,
    weekdays,
    ends_on: recurring ? payload.ends_on || null : null,
    due_date: recurring
      ? nextOccurrenceIso(type, payload.time_of_day, weekdays, now, payload.ends_on || null)
      : payload.due_date,
    schedule_label: describeScheduleLocal(type, payload.time_of_day, weekdays),
    completed_count: 0,
    created_at: new Date(now).toISOString(),
    needsSync: true,
    syncAction: 'create',
    fieldsDirty: true,
    statusQueue: [],
    deleted: false,
    rev: 1,
  };
}

const markDirty = (task, extra = {}) => ({
  ...task,
  ...extra,
  needsSync: true,
  syncAction: task.syncAction === 'create' ? 'create' : 'update',
  rev: (task.rev || 0) + 1,
});

/** Edit text / time. `changes` may hold title, description, category, due_date, time_of_day. */
export function applyEdit(task, changes, now = Date.now()) {
  const next = { ...task };
  for (const key of ['title', 'description', 'category']) {
    if (key in changes) next[key] = changes[key];
  }
  if (!isRecurring(task) && changes.due_date) next.due_date = changes.due_date;
  if (isRecurring(task) && changes.time_of_day) {
    next.time_of_day = changes.time_of_day;
    next.due_date = nextOccurrenceIso(task.schedule_type, changes.time_of_day, task.weekdays, now, task.ends_on);
    next.schedule_label = describeScheduleLocal(task.schedule_type, changes.time_of_day, task.weekdays);
  }
  return markDirty(next, { fieldsDirty: true });
}

/**
 * Complete / re-open. Mirrors the server: completing a daily or weekly reminder only finishes THIS
 * occurrence, so it stays "pending" and rolls to the next due date.
 */
export function applyStatus(task, status, now = Date.now()) {
  if (isRecurring(task)) {
    if (status !== 'completed') return task;
    const due = task.due_date ? new Date(task.due_date).getTime() : now;
    const nextDue = nextOccurrenceIso(task.schedule_type, task.time_of_day, task.weekdays, Math.max(now, due), task.ends_on);
    return markDirty(task, {
      status: nextDue ? 'pending' : 'completed',
      due_date: nextDue || task.due_date,
      completed_count: (task.completed_count || 0) + 1,
      statusQueue: [...(task.statusQueue || []), 'completed'],
    });
  }
  if (task.status === status) return task;
  return markDirty(task, { status, statusQueue: [status] });
}

/** Returns null when the record can simply disappear (it never reached the server). */
export function applyDelete(task, inFlight = false) {
  if (isLocalId(task.id) && !inFlight) return null;
  return {
    ...task,
    deleted: true,
    needsSync: true,
    syncAction: isLocalId(task.id) ? task.syncAction : 'delete',
    rev: (task.rev || 0) + 1,
  };
}

/** Server task -> clean local record (nothing waiting to sync). */
export const fromServer = (server, rev = 1) => ({
  ...server,
  clientId: server.client_id || null,
  needsSync: false,
  syncAction: null,
  fieldsDirty: false,
  statusQueue: [],
  deleted: false,
  rev,
});

export const toCreatePayload = (t) => {
  const p = {
    title: t.title,
    description: t.description || null,
    category: t.category,
    status: 'pending',
    schedule_type: t.schedule_type,
    client_id: t.clientId,
  };
  if (t.schedule_type === 'once') p.due_date = t.due_date;
  else {
    p.time_of_day = t.time_of_day;
    if (t.schedule_type === 'weekly') p.weekdays = t.weekdays;
    if (t.ends_on) p.ends_on = t.ends_on;
  }
  return p;
};

export const toUpdatePayload = (t) => {
  const p = { title: t.title, description: t.description || null, category: t.category };
  if (t.schedule_type === 'once') p.due_date = t.due_date;
  else p.time_of_day = t.time_of_day;
  return p;
};
