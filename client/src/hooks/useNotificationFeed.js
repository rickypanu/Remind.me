import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getAllTasks, subscribeTasks } from "../offline/db";
import { buildFeed, lastSundayEvening, unreadCount } from "../utils/notificationFeed";

const SEEN_KEY = "rm-seen-notifications";
const SHOWN_KEY = "rm-weekly-shown";

const readSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]"));
  } catch {
    return new Set();
  }
};

/** Feed for the bell: items, unread count, and `markAllSeen`. Refreshes when reminders change and every minute. */
export default function useNotificationFeed(enabled) {
  const [tasks, setTasks] = useState([]);
  const [now, setNow] = useState(Date.now());
  const [seen, setSeen] = useState(readSeen);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    const load = () => getAllTasks().then((all) => alive && setTasks(all.filter((t) => !t.deleted))).catch(() => {});
    load();
    const off = subscribeTasks(load);
    const tick = setInterval(() => setNow(Date.now()), 60000);
    return () => {
      alive = false;
      off();
      clearInterval(tick);
    };
  }, [enabled]);

  const items = useMemo(() => (enabled ? buildFeed(tasks, now) : []), [enabled, tasks, now]);
  const unread = unreadCount(items, seen);

  const markAllSeen = useCallback(() => {
    setSeen((prev) => {
      const next = new Set(prev);
      for (const x of items) next.add(x.id);
      // keep the list from growing for ever: only ids still in the feed matter
      const keep = new Set([...next].filter((id) => items.some((x) => x.id === id)));
      try {
        localStorage.setItem(SEEN_KEY, JSON.stringify([...keep]));
      } catch {
        /* private mode: the badge just comes back next visit */
      }
      return keep;
    });
  }, [items]);

  // When alerts are allowed and the page is open on Sunday evening, show the weekly summary as a system notification too.
  const shown = useRef(false);
  useEffect(() => {
    if (!enabled || shown.current) return;
    const week = items.find((x) => x.kind === "week");
    if (!week || typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (Date.now() - lastSundayEvening() > 6 * 3600 * 1000) return; // only within a few hours of Sunday 8 pm
    try {
      if (localStorage.getItem(SHOWN_KEY) === week.id) return;
      localStorage.setItem(SHOWN_KEY, week.id);
    } catch {
      /* ignore */
    }
    shown.current = true;
    const options = { body: week.body, icon: "/icon-192x192.png", tag: week.id };
    navigator.serviceWorker?.getRegistration().then((reg) => (reg ? reg.showNotification(week.title, options) : new Notification(week.title, options))).catch(() => {});
  }, [enabled, items]);

  return { items, unread, markAllSeen };
}
