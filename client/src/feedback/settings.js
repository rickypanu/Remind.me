import { useSyncExternalStore } from 'react';

/**
 * Sound / vibration preferences. Kept in localStorage (instant, synchronous) and mirrored to a tiny
 * IndexedDB the service worker can read, so push notifications respect the same choices.
 */
const KEY = 'remindme-feedback-settings';

export const DEFAULT_SETTINGS = {
  soundEffects: true, // in-app sounds when a reminder is added / updated / completed
  haptics: true, // navigator.vibrate on the same actions (and on notifications)
  alertSound: 'system', // notification sound: 'system' | built-in id | 'custom'
  customSoundName: '',
};

function load() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

let current = load();
const subs = new Set();
const emit = () => subs.forEach((fn) => fn());

// ---- mirror for the service worker (raw IndexedDB: no libraries inside the worker) -----------
function openSwDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('remindme-sw', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function mirrorToServiceWorker(s) {
  try {
    const db = await openSwDb();
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(
      { soundEffects: s.soundEffects, haptics: s.haptics, alertSound: s.alertSound },
      'settings'
    );
    await new Promise((resolve) => (tx.oncomplete = tx.onerror = tx.onabort = resolve));
    db.close();
  } catch {
    /* private mode etc. */
  }
}

export const getSettings = () => current;

export function updateSettings(patch) {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* storage unavailable: still applies for this session */
  }
  mirrorToServiceWorker(current);
  emit();
}

export function useFeedbackSettings() {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    getSettings,
    getSettings
  );
}

if (typeof window !== 'undefined') {
  mirrorToServiceWorker(current);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      current = load();
      emit();
    }
  });
}
