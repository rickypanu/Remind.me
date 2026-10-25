import { queryClient } from "./queryClient";
import { wipeOfflineData } from "../offline/db";

export const AUTH_EXPIRED_EVENT = "remindme:auth-expired";

// "token" keeps its old name so sessions that are already open survive the upgrade.
const ACCESS_KEY = "token";
const REFRESH_KEY = "refresh_token";

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/**
 * The user id inside the access token (its `sub` claim), or null. The token is only DECODED here, not verified:
 * the server verifies it on every request. This is used to tell whether a copy of the profile saved on this device
 * belongs to the person who is signed in, so a saved copy of someone else is never shown.
 */
export function getTokenUserId() {
  try {
    const part = (getToken() || "").split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "="));
    const sub = JSON.parse(json)?.sub;
    return sub ? String(sub) : null;
  } catch {
    return null;
  }
}

/** Short-lived access token (about 15 minutes). Sent on every API request. */
export const getToken = () => read(ACCESS_KEY);

/** Long-lived, single-use refresh token. Only ever sent to /auth/refresh and /auth/logout. */
export const getRefreshToken = () => read(REFRESH_KEY);

export const isLoggedIn = () => !!getToken() || !!getRefreshToken();

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the session lasts until the next request fails */
  }
};
const erase = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    /* storage unavailable */
  }
};

/** Store a new access token. The ONLY place that writes it (the day it moves out of localStorage, edit here). */
export const setToken = (accessToken) => {
  if (accessToken) write(ACCESS_KEY, accessToken);
};
export const setRefreshToken = (refreshToken) => {
  if (refreshToken) write(REFRESH_KEY, refreshToken);
};

/** Store the pair returned by /auth/login and /auth/refresh. */
export function setSession({ access_token: accessToken, refresh_token: refreshToken }) {
  setToken(accessToken);
  setRefreshToken(refreshToken);
}

// ---- "what's new" badge: how many product updates this browser has already seen ---------------------
const SEEN_UPDATES_KEY = "seenUpdatesCount";
export const UPDATES_READ_EVENT = "updatesRead";

export const getSeenUpdatesCount = () => {
  const parsed = Number.parseInt(read(SEEN_UPDATES_KEY) || "0", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

/** Remember how many updates were seen and tell open badges to reset. */
export function setSeenUpdatesCount(count) {
  write(SEEN_UPDATES_KEY, String(Math.max(0, count | 0)));
  window.dispatchEvent(new Event(UPDATES_READ_EVENT));
}

/** Stop this browser from receiving the previous user's push reminders. Best effort. */
async function dropPushSubscription() {
  try {
    if (!("serviceWorker" in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager?.getSubscription();
    await sub?.unsubscribe();
  } catch {
    /* not critical */
  }
}

/**
 * Remove everything that belongs to the signed-in user from this browser.
 * keepOffline: used when the session merely EXPIRED, so reminders that were changed offline and have
 * not uploaded yet are not thrown away; they upload after the next login (and are wiped instead if a
 * different account signs in).
 */
export function clearSession({ keepOffline = false } = {}) {
  erase(ACCESS_KEY);
  erase(REFRESH_KEY);
  erase(SEEN_UPDATES_KEY);
  queryClient.clear();
  if (!keepOffline) wipeOfflineData();
  dropPushSubscription();
}

/** Called by the API client when the session cannot be renewed any more. */
export function signalAuthExpired() {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
