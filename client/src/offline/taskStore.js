import { feedback } from '../feedback/feedback';
import { emitTasksChanged, getDB, getMeta, idAliases, putTask } from './db';
import { requestSync, isInFlight } from './sync';
import { applyDelete, applyEdit, applyStatus, buildNewTask, isRecurring } from './taskModel';

/**
 * Every change is written to IndexedDB FIRST (flagged needsSync), the screen updates, and only then
 * is an upload attempted. Nothing here waits for the network.
 */
async function mutate(id, change) {
  const realId = idAliases.get(id) || id; // a create may have just been confirmed by the server
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  const current = await tx.store.get(realId);
  if (!current || current.deleted) {
    await tx.done;
    return { current: null, next: null };
  }
  const next = change(current, realId);
  if (next === null) await tx.store.delete(realId);
  else if (next !== current) await tx.store.put(next);
  await tx.done;
  if (next !== current) {
    emitTasksChanged();
    requestSync();
  }
  return { current, next };
}

export async function createTask(payload, { silent = false } = {}) {
  const task = buildNewTask(payload, await getMeta('ownerId'));
  await putTask(task);
  emitTasksChanged();
  requestSync();
  if (!silent) feedback.added();
  return task;
}

export async function editTask(id, changes, { silent = false } = {}) {
  const { next } = await mutate(id, (t) => applyEdit(t, changes));
  if (next && !silent) feedback.updated();
  return next;
}

/** Returns { task, completedRecurring } so the caller can word its message. */
export async function setTaskStatus(id, status, { silent = false } = {}) {
  const { current, next } = await mutate(id, (t) => applyStatus(t, status));
  if (!next || next === current) return { task: current, changed: false };
  if (!silent) {
    if (status === 'completed') feedback.completed();
    else feedback.updated();
  }
  return { task: next, changed: true, recurring: isRecurring(next) };
}

export async function deleteTask(id, { silent = false } = {}) {
  const { current } = await mutate(id, (t, realId) => applyDelete(t, isInFlight(realId)));
  if (current && !silent) feedback.deleted();
  return !!current;
}
