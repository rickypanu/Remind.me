import { tasksApi } from '../api/tasks';
import { getToken } from '../utils/auth';
import { getErrorMessage } from '../utils/errors';
import notify from '../utils/notify';
import {
  getAllTasks, getDB, getMeta, setMeta, removeTask, putTask, countPending, emitTasksChanged, subscribeTasks, idAliases,
} from './db';
import { fromServer, isLocalId, toCreatePayload, toUpdatePayload } from './taskModel';

/**
 * Sync engine: pushes everything flagged `needsSync` to the API (oldest creates first, then edits,
 * then deletes), then pulls the server's list so this device converges on the real state.
 *
 *  - Triggers: the `online` event, tab becoming visible, a Background Sync message from the service
 *    worker, every local change (when online), a 60 s heartbeat, and retries with back-off.
 *  - Safe to retry: creates carry a client_id (the API ignores repeats); a local change made while
 *    a request is in flight bumps `rev`, so the flag is kept instead of being cleared by mistake.
 */
const BG_SYNC_TAG = 'remindme-sync';

// ---- observable state (for useSyncStatus / the connection indicator) -------------------------
let state = {
  netOnline: typeof navigator === 'undefined' ? true : navigator.onLine,
  reachable: true, // false after a request failed with no response at all
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  lastResult: null, // { type: 'success' | 'network' | 'error', count, at }
};
const subs = new Set();
function setState(patch) {
  const next = { ...state, ...patch };
  next.online = next.netOnline && next.reachable;
  state = next;
  subs.forEach((fn) => fn());
}
export const getSyncState = () => state;
export function subscribeSync(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
export async function refreshPending() {
  try {
    setState({ pending: await countPending() });
  } catch {
    /* IndexedDB unavailable */
  }
}

// ---- helpers ------------------------------------------------------------------------------------
const inFlight = new Set();
export const isInFlight = (id) => inFlight.has(id);

const isNetworkError = (err) => !err?.response; // offline, DNS, CORS, timeout...
const rank = (t) => (t.syncAction === 'create' ? 0 : t.syncAction === 'update' ? 1 : 2);

let lastPullAt = 0;
let retryTimer = null;
let retryDelay = 5000;

function scheduleRetry() {
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => syncNow({ force: true }), retryDelay);
  retryDelay = Math.min(retryDelay * 2, 60000);
}
function resetBackoff() {
  clearTimeout(retryTimer);
  retryDelay = 5000;
}

// ---- push ---------------------------------------------------------------------------------------
async function finalize(oldId, serverId, serverRecord, sentRev, sentQueueLen) {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  const store = tx.objectStore('tasks');
  const cur = await store.get(oldId);
  if (!cur) {
    await tx.done;
    return;
  }

  let next;
  if (cur.rev === sentRev) {
    // Nothing changed while the request was in flight: the server copy is now the truth.
    next = serverRecord
      ? fromServer(serverRecord, cur.rev)
      : { ...cur, id: serverId, needsSync: false, syncAction: null, fieldsDirty: false, statusQueue: [] };
  } else {
    // The user changed it again meanwhile: keep their newer version flagged for another round.
    next = {
      ...cur,
      id: serverId,
      needsSync: true,
      syncAction: cur.deleted ? 'delete' : 'update',
      fieldsDirty: !cur.deleted,
      statusQueue: (cur.statusQueue || []).slice(sentQueueLen),
    };
  }
  if (serverId !== oldId) {
    idAliases.set(oldId, serverId);
    await store.delete(oldId);
  }
  await store.put(next);
  await tx.done;
}

async function pushRecord(t) {
  if (t.syncAction === 'delete') {
    if (!isLocalId(t.id)) {
      try {
        await tasksApi.remove(t.id);
      } catch (err) {
        if (err.response?.status !== 404) throw err; // already gone = success
      }
    }
    await removeTask(t.id);
    return;
  }

  let serverId = t.id;
  let serverRecord = null;
  if (t.syncAction === 'create') {
    const data = await tasksApi.create(toCreatePayload(t));
    serverId = data.id;
    serverRecord = data;
  } else if (t.fieldsDirty) {
    serverRecord = await tasksApi.update(t.id, toUpdatePayload(t));
  }

  const queue = t.statusQueue || [];
  for (const status of queue) await tasksApi.setStatus(serverId, status);

  await finalize(t.id, serverId, serverRecord, t.rev, queue.length);
}

/** The server refused this change for good (validation, moderation, task gone). Don't retry forever. */
async function handleRejected(t, err) {
  const status = err.response?.status;
  const message = getErrorMessage(err, 'The server did not accept it.');
  if (t.syncAction === 'delete' || status === 404) {
    await removeTask(t.id); // gone on the server either way
    return;
  }
  if (t.syncAction === 'create') {
    await removeTask(t.id);
    notify.error(`"${t.title}" couldn't be saved: ${message}`, undefined, { duration: 7000 });
    return;
  }
  // A rejected edit: stop retrying; the pull that follows restores the server's version.
  await putTask({ ...t, needsSync: false, syncAction: null, fieldsDirty: false, statusQueue: [] });
  notify.error(`Your change to "${t.title}" was rejected: ${message}`, undefined, { duration: 7000 });
}

async function syncOne(t) {
  inFlight.add(t.id);
  try {
    await pushRecord(t);
  } catch (err) {
    const status = err.response?.status;
    if (status && status >= 400 && status < 500 && status !== 401 && status !== 408 && status !== 429) {
      await handleRejected(t, err);
    } else {
      throw err;
    }
  } finally {
    inFlight.delete(t.id);
  }
}

// ---- pull ---------------------------------------------------------------------------------------
const CURSOR_KEY = 'syncCursor';
const PAGE_SIZE = 200;
const MAX_PAGES = 200; // safety net against a server that never says "no more"

/** Apply one page of server changes to the local store. Never overwrites a change that is still waiting to upload. */
async function applyPage(page, seen) {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  const store = tx.objectStore('tasks');
  const local = await store.getAll();
  const byId = new Map(local.map((t) => [t.id, t]));
  const pendingClientIds = new Set(local.filter((t) => t.needsSync && isLocalId(t.id)).map((t) => t.clientId));

  for (const s of page.items || []) {
    seen?.add(s.id);
    const mine = byId.get(s.id);
    if (mine?.needsSync) continue; // never overwrite a change that hasn't been uploaded yet
    if (s.client_id && pendingClientIds.has(s.client_id)) continue; // our own create, mid-retry
    await store.put(fromServer(s, mine?.rev || 1));
  }
  for (const gone of page.deleted || []) {
    const mine = byId.get(gone.id);
    if (mine && !mine.needsSync) await store.delete(gone.id); // deleted on another device
  }
  await tx.done;
}

/** Drop synced local reminders that a full snapshot did not mention (deleted while this device was away). */
async function pruneAfterSnapshot(seen) {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  const store = tx.objectStore('tasks');
  for (const t of await store.getAll()) {
    if (!t.needsSync && !seen.has(t.id)) await store.delete(t.id);
  }
  await tx.done;
}

/**
 * Delta sync. The first pull (no stored cursor) downloads a snapshot; later pulls only fetch what changed
 * since the cursor, including tombstones for deletes. The cursor is stored only after a page is applied, so
 * a crash mid-pull just repeats work (idempotent). A 410 means the cursor is older than the server keeps
 * tombstones for: forget it and download a snapshot again.
 */
export async function pullFromServer({ full = false } = {}) {
  let cursor = full ? null : (await getMeta(CURSOR_KEY)) || null;
  const seen = new Set();
  let snapshot = !cursor;

  try {
    for (let i = 0; i < MAX_PAGES; i++) {
      const params = { limit: PAGE_SIZE };
      if (cursor) params.cursor = cursor;
      const data = await tasksApi.changes(params);
      snapshot = snapshot && !!data.snapshot;
      await applyPage(data, snapshot ? seen : null);
      cursor = data.next_cursor;
      if (!data.has_more) {
        if (data.snapshot) await pruneAfterSnapshot(seen);
        await setMeta(CURSOR_KEY, cursor);
        break;
      }
      if (!data.snapshot) await setMeta(CURSOR_KEY, cursor); // deltas can be resumed page by page
    }
  } catch (err) {
    if (err.response?.status === 410 && !full) {
      await setMeta(CURSOR_KEY, null);
      return pullFromServer({ full: true });
    }
    throw err;
  }

  lastPullAt = Date.now();
  await setMeta('lastPullAt', lastPullAt);
  emitTasksChanged();
}

// ---- flush --------------------------------------------------------------------------------------
let flushing = null;

async function runFlush() {
  if (!getToken() || !navigator.onLine) return { ok: false, reason: 'offline' };
  const waiting = await countPending();
  if (!waiting) return { ok: true, synced: 0 };

  setState({ syncing: true });
  let synced = 0;
  try {
    for (let pass = 0; pass < 3; pass++) {
      const queue = (await getAllTasks()).filter((t) => t.needsSync).sort((a, b) => rank(a) - rank(b));
      if (!queue.length) break;
      for (const t of queue) {
        await syncOne(t);
        synced++;
      }
    }
    await pullFromServer();
    resetBackoff();
    setState({ reachable: true, lastResult: { type: 'success', count: synced, at: Date.now() } });
    return { ok: true, synced };
  } catch (err) {
    if (isNetworkError(err)) {
      setState({ reachable: false, lastResult: { type: 'network', at: Date.now() } });
      registerBackgroundSync();
    } else if (err.response?.status !== 401) {
      setState({ lastResult: { type: 'error', at: Date.now() } });
    }
    scheduleRetry();
    return { ok: false, reason: 'error' };
  } finally {
    setState({ syncing: false });
    emitTasksChanged();
    refreshPending();
  }
}

export function flushPending() {
  if (!flushing) flushing = runFlush().finally(() => (flushing = null));
  return flushing;
}

/** Upload anything waiting; otherwise refresh from the server (at most every 20 s unless forced). */
export async function syncNow({ force = false } = {}) {
  if (!getToken() || !navigator.onLine) return;
  if (await countPending()) return flushPending();
  if (!force && Date.now() - lastPullAt < 20000) return;
  try {
    await pullFromServer();
    setState({ reachable: true });
  } catch (err) {
    if (isNetworkError(err)) setState({ reachable: false });
  }
}

/** Tests only: forget timers, in-flight markers and cached state so each test starts from a clean engine. */
export function resetSyncEngine() {
  clearTimeout(retryTimer);
  clearTimeout(debounce);
  retryDelay = 5000;
  lastPullAt = 0;
  flushing = null;
  inFlight.clear();
  idAliases.clear();
  state = {
    netOnline: true,
    reachable: true,
    online: true,
    syncing: false,
    pending: 0,
    lastResult: null,
  };
}

// ---- Background Sync API -------------------------------------------------------------------------
/** Asks the browser to wake the service worker when the connection returns (Chromium; harmless elsewhere). */
export async function registerBackgroundSync() {
  try {
    const reg = await navigator.serviceWorker?.ready;
    if (reg && 'sync' in reg) await reg.sync.register(BG_SYNC_TAG);
  } catch {
    /* unsupported: the `online` listener covers it */
  }
}

let debounce = null;
/** Call after every local change. */
export function requestSync() {
  refreshPending();
  if (navigator.onLine) {
    clearTimeout(debounce);
    debounce = setTimeout(() => flushPending(), 250);
  } else {
    registerBackgroundSync();
  }
}

// ---- lifecycle -----------------------------------------------------------------------------------
let users = 0;
let teardown = null;

/** Start listening (ref-counted so React StrictMode's double mount is harmless). Returns a stop function. */
export function startSyncEngine() {
  users += 1;
  if (users === 1) {
    const onOnline = () => {
      setState({ netOnline: true, reachable: true });
      resetBackoff();
      syncNow({ force: true });
    };
    const onOffline = () => setState({ netOnline: false });
    const onVisible = () => {
      if (document.visibilityState === 'visible') syncNow();
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = subscribeTasks(refreshPending);
    const heartbeat = setInterval(() => document.visibilityState === 'visible' && syncNow(), 60000);

    setState({ netOnline: navigator.onLine });
    refreshPending();
    syncNow({ force: true });

    teardown = () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
      clearInterval(heartbeat);
      clearTimeout(retryTimer);
    };
  }
  return () => {
    users -= 1;
    if (users === 0) teardown?.();
  };
}
