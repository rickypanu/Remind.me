import { queryClient } from "./queryClient";
import { wipeOfflineData } from "../offline/db";

export const AUTH_EXPIRED_EVENT = "remindme:auth-expired";

export const getToken = () => {
  try {
    return localStorage.getItem("token");
  } catch {
    return null;
  }
};

export const isLoggedIn = () => !!getToken();

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
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("seenUpdatesCount");
  } catch {
    /* storage unavailable */
  }
  queryClient.clear();
  if (!keepOffline) wipeOfflineData();
  dropPushSubscription();
}

/** Called by the API client when the server says the token is no longer valid. */
export function signalAuthExpired() {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
