import React, { useEffect, useRef } from "react";
import { WifiOff, Loader2, CloudOff } from "lucide-react";
import useSyncStatus from "../offline/useSyncStatus";
import notify from "../utils/notify";

const TOAST_ID = "rm-sync"; // one id = the "Syncing..." toast turns into "Saved" instead of stacking

/**
 * 1. A small pill at the bottom of the screen: "Offline mode", "Syncing...", or "N waiting to sync".
 * 2. A toast when the connection returns ("Syncing...") that becomes "Changes saved to cloud".
 * Mounted once in App.jsx.
 */
export default function ConnectionStatus() {
  const s = useSyncStatus();
  const prev = useRef({ online: s.online, resultAt: s.lastResult?.at });

  useEffect(() => {
    const before = prev.current;
    prev.current = { online: s.online, resultAt: s.lastResult?.at };

    if (!before.online && s.online) {
      if (s.pending > 0) notify.loading("Back online. Syncing your changes…", { id: TOAST_ID });
      else notify.info("You're back online.", { id: TOAST_ID, icon: "✅", duration: 2200 });
    }

    const r = s.lastResult;
    if (r && r.at !== before.resultAt) {
      if (r.type === "success" && r.count > 0) {
        notify.success("Changes saved to cloud", { id: TOAST_ID, icon: "☁️" });
      } else if (r.type === "error") {
        notify.error("Sync paused. We'll try again in a moment.", undefined, { id: TOAST_ID });
      } else {
        notify.dismiss(TOAST_ID); // went offline again mid-sync: the pill already says so
      }
    }
  }, [s.online, s.pending, s.lastResult]);

  const visible = !s.online || s.syncing || s.pending > 0;
  if (!visible) return null;

  let Icon = CloudOff;
  let text = `${s.pending} waiting to sync`;
  if (!s.online) {
    Icon = WifiOff;
    text = s.pending > 0 ? `Offline mode · ${s.pending} waiting to sync` : "Offline mode · changes save on this device";
  } else if (s.syncing) {
    Icon = Loader2;
    text = "Syncing…";
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)" }}
    >
      <div
        className="rm-pill-in inline-flex max-w-full items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold shadow-lg ring-1 ring-black/5"
        style={{ background: "var(--rm-toast-bg)", color: "var(--rm-toast-fg)" }}
      >
        <Icon size={14} strokeWidth={2.5} className={s.online && s.syncing ? "animate-spin shrink-0" : "shrink-0"} aria-hidden="true" />
        <span className="truncate">{text}</span>
      </div>
    </div>
  );
}
