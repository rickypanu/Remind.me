/* Loaded into the generated service worker (vite.config.js -> workbox.importScripts).
 * Handles: push notifications (+ sound / vibration preferences), notification taps, Background Sync. */

// ---- preferences saved by the app (src/feedback/settings.js) -------------------------------------
function readSettings() {
  const fallback = { soundEffects: true, haptics: true, alertSound: 'system' };
  return new Promise((resolve) => {
    try {
      const open = indexedDB.open('remindme-sw', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('kv');
      open.onerror = () => resolve(fallback);
      open.onsuccess = () => {
        const db = open.result;
        const get = db.transaction('kv', 'readonly').objectStore('kv').get('settings');
        get.onsuccess = () => {
          db.close();
          resolve({ ...fallback, ...(get.result || {}) });
        };
        get.onerror = () => {
          db.close();
          resolve(fallback);
        };
      };
    } catch {
      resolve(fallback);
    }
  });
}

// ---- push -------------------------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let data = { title: 'Reminder', body: '' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(
    (async () => {
      const settings = await readSettings();
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      const appIsOpen = windows.some((c) => c.visibilityState === 'visible');

      // A custom / built-in alert sound can only be played by the page itself. When the app is open,
      // let the page play it and keep the system notification silent so it isn't doubled. When the app
      // is closed the browser plays the device's normal notification sound (a platform limit).
      const pageHandlesSound = appIsOpen && settings.alertSound !== 'system';
      if (appIsOpen) windows.forEach((c) => c.postMessage({ type: 'PLAY_ALERT' }));

      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: data.tag || undefined,
        vibrate: settings.haptics ? [100, 50, 100] : undefined,
        silent: pageHandlesSound ? true : undefined,
      });
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windows) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow('/dashboard');
    })()
  );
});

// ---- Background Sync ---------------------------------------------------------------------------------
// The page registers 'remindme-sync' while offline. When the browser sees a connection again it wakes
// this worker, which asks an open page to upload the queued changes (the page owns the login token
// and the IndexedDB logic). With no page open, the upload happens as soon as the app is opened.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'remindme-sync') return;
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      windows.forEach((c) => c.postMessage({ type: 'REMINDME_SYNC' }));
    })
  );
});
