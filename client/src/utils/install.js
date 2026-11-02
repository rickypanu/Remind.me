import { useSyncExternalStore } from "react";

/**
 * "Add to Home screen" support for the PWA.
 *
 *  - Android / desktop Chrome and Edge: the browser fires `beforeinstallprompt` ONCE, early. It is captured here
 *    (call `initInstallCapture()` before React renders) so a button anywhere in the app can open the real install
 *    dialog later.
 *  - iPhone / iPad (Safari): there is no install API. People must use Share -> Add to Home Screen, so the app shows
 *    short step-by-step instructions instead.
 *  - Already installed (opened from the home screen): every install prompt hides itself.
 */
let deferred = null;
let installed = false;
const listeners = new Set();
let snapshot = null;

const ua = () => (typeof navigator === "undefined" ? "" : navigator.userAgent || "");

export const isStandalone = () => {
  if (typeof window === "undefined") return false;
  return !!(window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);
};

// iPadOS 13+ reports itself as a Mac with touch support
export const isIos = () =>
  /iPhone|iPad|iPod/i.test(ua()) || (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isAndroid = () => /Android/i.test(ua());
/** Only Safari can add to the Home screen on iOS (Chrome / Firefox / in-app browsers cannot, before iOS 16.4). */
const isIosSafari = () => isIos() && /Safari/i.test(ua()) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV|Line/i.test(ua());

function compute() {
  const standalone = installed || isStandalone();
  const next = {
    standalone,
    canPrompt: !standalone && !!deferred,
    ios: !standalone && isIos(),
    iosSafari: !standalone && isIosSafari(),
    android: isAndroid(),
  };
  const prev = snapshot;
  if (prev && Object.keys(next).every((k) => prev[k] === next[k])) return prev; // stable reference for useSyncExternalStore
  snapshot = next;
  return snapshot;
}
const emit = () => {
  compute();
  listeners.forEach((fn) => fn());
};

let initialised = false;
export function initInstallCapture() {
  if (initialised || typeof window === "undefined") return;
  initialised = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault(); // we show our own button instead of the browser's mini-bar
    deferred = event;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
  window.matchMedia?.("(display-mode: standalone)").addEventListener?.("change", emit);
}

/** Opens the browser's install dialog. Resolves true when the person accepted. */
export async function promptInstall() {
  if (!deferred) return false;
  const event = deferred;
  deferred = null; // a prompt can be used once
  emit();
  try {
    await event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === "accepted";
  } catch {
    return false;
  }
}

const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** `{ standalone, canPrompt, ios, iosSafari, android }`; re-renders when the state changes. */
export default function useInstall() {
  return useSyncExternalStore(subscribe, compute, compute);
}

// ---- "Not now" memory for the dashboard banner ---------------------------------------------------
const DISMISS_KEY = "remindme-install-dismissed";
const DISMISS_DAYS = 14;
export function installBannerDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86400000;
  } catch {
    return false;
  }
}
export function dismissInstallBanner() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode: the banner simply returns next visit */
  }
}
