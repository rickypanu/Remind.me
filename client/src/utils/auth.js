import { queryClient } from "./queryClient";

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

/** Remove everything that belongs to the signed-in user from this browser. */
export function clearSession() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("seenUpdatesCount");
  } catch {
    /* storage unavailable */
  }
  queryClient.clear();
  dropPushSubscription();
}

/** Called by the API client when the server says the token is no longer valid. */
export function signalAuthExpired() {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}
