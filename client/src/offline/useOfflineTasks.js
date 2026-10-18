import { useCallback, useEffect, useRef, useState } from 'react';
import { claimOwner, getAllTasks, subscribeTasks } from './db';
import { syncNow } from './sync';
import { createTask, deleteTask, editTask, setTaskStatus } from './taskStore';
import { applyEdit, applyStatus } from './taskModel';

/**
 * useOfflineTasks(userId)
 *
 * The screen reads reminders from IndexedDB, never straight from the network. Writes are applied to
 * the visible list immediately (optimistic UI), saved to IndexedDB flagged `needsSync`, and uploaded
 * in the background by the sync engine.
 *
 * userId: `undefined` while the profile is still loading, `null` if it can't be determined.
 *
 *   const { tasks, ready, addTask, editTask, toggleTask, removeTask } = useOfflineTasks(userId);
 */
export default function useOfflineTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const listRef = useRef([]);

  const commit = useCallback((list) => {
    listRef.current = list;
    setTasks(list);
  }, []);

  const load = useCallback(async () => {
    const all = await getAllTasks();
    commit(all.filter((t) => !t.deleted));
    setReady(true);
  }, [commit]);

  useEffect(() => {
    if (userId === undefined) return undefined; // wait until we know whose reminders these are
    let cancelled = false;
    (async () => {
      try {
        await claimOwner(userId); // a different account on this browser starts from a clean slate
        if (!cancelled) await load();
      } catch {
        if (!cancelled) setReady(true); // IndexedDB blocked: show an empty list rather than spinning forever
      }
      if (!cancelled) syncNow({ force: true });
    })();
    const unsubscribe = subscribeTasks(() => !cancelled && load());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [userId, load]);

  const withRollback = useCallback(
    async (optimisticList, action) => {
      commit(optimisticList); // 1. the screen changes right now
      try {
        return await action(); // 2. IndexedDB + background upload
      } catch (err) {
        await load(); // storage failed: show what is really saved
        throw err;
      }
    },
    [commit, load]
  );

  const addTask = useCallback((payload) => createTask(payload), []);

  const edit = useCallback(
    (id, changes) =>
      withRollback(
        listRef.current.map((t) => (t.id === id ? applyEdit(t, changes) : t)),
        () => editTask(id, changes)
      ),
    [withRollback]
  );

  /** Completes a pending task / re-opens a completed one. Sound + vibration are the caller's job (silent). */
  const toggleTask = useCallback(
    (task) => {
      const status = task.status === 'completed' ? 'pending' : 'completed';
      return withRollback(
        listRef.current.map((t) => (t.id === task.id ? applyStatus(t, status) : t)),
        () => setTaskStatus(task.id, status, { silent: true })
      );
    },
    [withRollback]
  );

  const removeTask = useCallback(
    (task) =>
      withRollback(
        listRef.current.filter((t) => t.id !== task.id),
        () => deleteTask(task.id)
      ),
    [withRollback]
  );

  return { tasks, ready, addTask, editTask: edit, toggleTask, removeTask, refresh: load };
}

