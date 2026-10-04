// Loaded into the generated Workbox service worker via workbox.importScripts in vite.config.js

const ICON = '/icon-192x192.png';

self.addEventListener('push', (event) => {
  let data = { title: 'Reminder', body: '' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: ICON,
    badge: ICON,
    vibrate: [100, 50, 100],
    data, // keep the whole payload so notificationclick can use it
  };

  // Same task => replace the old notification instead of stacking duplicates
  if (data.task_id) {
    options.tag = `task-${data.task_id}`;
    options.renotify = true;
  }

  // Only task reminders carry a signed token, so only they get buttons
  if (data.action_token && data.action_url) {
    options.actions = [
      { action: 'done', title: 'Mark done' },
      { action: 'snooze', title: 'Snooze 10 min' },
    ];
  }

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action; // '' when the notification body is tapped
  const data = event.notification.data || {};
  event.notification.close();

  if ((action === 'done' || action === 'snooze') && data.action_token && data.action_url) {
    event.waitUntil(handleTaskAction(action, data));
    return;
  }

  event.waitUntil(openApp(data.url || '/dashboard'));
});

async function handleTaskAction(action, data) {
  const tag = `task-${data.task_id}`;
  const SNOOZE_MINUTES = 10;

  try {
    const res = await fetch(data.action_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: data.action_token,
        action,
        minutes: SNOOZE_MINUTES,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    await self.registration.showNotification(
      action === 'done' ? 'Task completed' : 'Snoozed',
      {
        body:
          action === 'done'
            ? `"${data.task_title}" is marked as done.`
            : `I'll remind you about "${data.task_title}" in ${SNOOZE_MINUTES} minutes.`,
        icon: ICON,
        tag,
        silent: true,
      }
    );
  } catch (err) {
    await self.registration.showNotification('Could not update the task', {
      body: 'Open the app and try again.',
      icon: ICON,
      tag,
      data: { url: data.url || '/dashboard' },
    });
    return;
  }

  // Let the confirmation show for a few seconds, then dismiss it
  await new Promise((resolve) => setTimeout(resolve, 4000));
  const shown = await self.registration.getNotifications({ tag });
  shown.forEach((n) => n.close());
}

async function openApp(url) {
  const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    if ('focus' in client) return client.focus();
  }
  return clients.openWindow(url);
}