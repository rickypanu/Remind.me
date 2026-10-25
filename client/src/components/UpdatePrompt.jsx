import React from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const CHECK_EVERY_MS = 60 * 60 * 1000;

/**
 * Registers the service worker and, when a new version has been downloaded, asks before switching to it
 * (finding P10). Swapping code silently under an open page could break a form the user is filling in.
 */
export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), CHECK_EVERY_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-2xl"
      style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <span className="font-medium">A new version of RemindMe is ready.</span>
      <span className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          className="rounded-full px-3 py-1.5 font-semibold text-slate-200 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Later
        </button>
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="rounded-full bg-white px-3 py-1.5 font-semibold text-slate-900 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Reload
        </button>
      </span>
    </div>
  );
}
