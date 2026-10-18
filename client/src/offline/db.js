import { openDB } from 'idb';

/**
 * Local database (IndexedDB, via the tiny `idb` wrapper).
 *
 *   tasks  : every reminder this device knows about. Records the user changed while offline carry
 *            `needsSync: true` until the server has accepted them.
 *   meta   : small key/value pairs (owner id, cached profile, last pull time)
 *   files  : binary blobs (the user's custom notification sound)
 *
 * Task record = the API's task shape +
 *   needsSync    boolean   true until the server has this change
 *   syncAction   'create' | 'update' | 'delete' | null
 *   fieldsDirty  boolean   text/time edits that still need a PUT
 *   statusQueue  string[]  completions waiting for a PATCH, sent in order
 *   deleted      boolean   tombstone: hidden in the UI, removed once the server confirms
 *   rev          number    bumped on every local change (detects edits made while a sync was in flight)
 *   clientId     string    sent as client_id so a retried create can never make a duplicate
 */
const DB_NAME = 'remindme-offline';
const DB_VERSION = 1;

let dbPromise;
export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore('tasks', { keyPath: 'id' });
        db.createObjectStore('meta');
        db.createObjectStore('files');
      },
      terminated() {
        dbPromise = null; // browser closed the connection: reopen next time
      },
    });
  }
  return dbPromise;
}

// ---- change notifications (this tab + other tabs) --------------------------
const listeners = new Set();
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('remindme-tasks') : null;
if (channel) channel.onmessage = () => listeners.forEach((fn) => fn());

export function emitTasksChanged() {
  listeners.forEach((fn) => fn());
  channel?.postMessage('changed');
}
export function subscribeTasks(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** local id -> server id, for taps that land while a create is being confirmed (this page load only). */
export const idAliases = new Map();

// ---- tasks -------------------------------------------------------------------
export async function getAllTasks() {
  return (await getDB()).getAll('tasks');
}
export async function getTask(id) {
  return (await getDB()).get('tasks', id);
}
export async function putTask(task) {
  return (await getDB()).put('tasks', task);
}
export async function removeTask(id) {
  return (await getDB()).delete('tasks', id);
}
export async function countPending() {
  const all = await getAllTasks();
  return all.filter((t) => t.needsSync).length;
}

// ---- meta / files ------------------------------------------------------------
export async function getMeta(key) {
  return (await getDB()).get('meta', key);
}
export async function setMeta(key, value) {
  return (await getDB()).put('meta', value, key);
}
export async function saveFile(key, blob) {
  return (await getDB()).put('files', blob, key);
}
export async function getFile(key) {
  return (await getDB()).get('files', key);
}
export async function deleteFile(key) {
  return (await getDB()).delete('files', key);
}

/** Remove everything that belongs to the signed-in user (called on log out). */
export async function wipeOfflineData() {
  try {
    const db = await getDB();
    const tx = db.transaction(['tasks', 'meta'], 'readwrite');
    await Promise.all([tx.objectStore('tasks').clear(), tx.objectStore('meta').clear(), tx.done]);
    emitTasksChanged();
  } catch {
    /* IndexedDB unavailable: nothing was stored */
  }
}

/** If a different account signs in on this browser, drop the previous account's local copy first. */
export async function claimOwner(userId) {
  if (!userId) return;
  const owner = await getMeta('ownerId');
  if (owner && owner !== userId) await wipeOfflineData();
  if (owner !== userId) await setMeta('ownerId', userId);
}
