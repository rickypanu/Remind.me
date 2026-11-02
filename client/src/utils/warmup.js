import { healthApi } from "../api";
import { API_ORIGIN } from "./api";

let started = false;
let lastPing = 0;
let listening = false;

const MIN_GAP_MS = 4 * 60 * 1000; // free hosts sleep after ~15 quiet minutes, so one ping every few minutes is plenty

/**
 * Wake the API. Free hosting puts a server to sleep after a quiet spell and a cold start can take 30 s or more;
 * asking for /health early means the server is already awake by the time the user taps "add" or "log in".
 * Throttled and fire-and-forget: it never throws and never blocks anything.
 */
export function pingServer({ force = false } = {}) {
  const now = Date.now();
  if (!force && now - lastPing < MIN_GAP_MS) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  lastPing = now;
  healthApi.check({ timeout: 60000 });
}

/**
 * Call once at start-up: opens the connection early, pings now, and pings again whenever the app comes back to the
 * foreground or the phone regains a connection (the moments a person is about to use it).
 */
export function warmUpServer() {
  if (started || typeof document === "undefined") return;
  started = true;
  try {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = API_ORIGIN;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {
    /* a hint only */
  }
  pingServer({ force: true });

  if (!listening) {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") pingServer();
    });
    window.addEventListener("online", () => pingServer({ force: true }));
    window.addEventListener("focus", () => pingServer());
  }
}
