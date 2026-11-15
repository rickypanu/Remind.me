import React, { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import Modal from "./Modal";
import notify from "../utils/notify";

const LENGTHS = [15, 25, 45, 60];
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** A simple focus timer for one reminder. Rings (a notification, if allowed) when the time is up, even in another tab. */
export default function FocusTimerDialog({ task, onClose }) {
  const [minutes, setMinutes] = useState(25);
  const [endsAt, setEndsAt] = useState(null);
  const [left, setLeft] = useState(0);
  const startRef = useRef(null);

  useEffect(() => {
    if (!endsAt) return undefined;
    const original = document.title;
    const tick = () => {
      const s = Math.max(0, Math.round((endsAt - Date.now()) / 1000));
      setLeft(s);
      document.title = s ? `${fmt(s)} · Focus` : original;
      if (s === 0) {
        setEndsAt(null);
        notify.success(`Focus session done: ${minutes} minutes.`);
        try {
          if ("Notification" in window && Notification.permission === "granted") new Notification("Focus session finished", { body: task.title });
        } catch { /* the in-page message is enough */ }
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => { clearInterval(id); document.title = original; };
  }, [endsAt]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = () => {
    try {
      if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    } catch { /* optional */ }
    setEndsAt(Date.now() + minutes * 60000);
  };
  const running = !!endsAt;

  return (
    <Modal onClose={onClose} labelledBy="focus-title" initialFocusRef={startRef}>
      <div className="rm-modal-in w-full max-w-sm rounded-[24px] bg-white p-6 text-center shadow-2xl">
        <p className="text-xs font-bold text-slate-500">Focus on</p>
        <h2 id="focus-title" data-no-translate className="mt-1 text-lg font-bold leading-snug text-slate-900 break-words">{task.title}</h2>
        <p className="my-6 text-6xl font-bold tabular-nums tracking-tight text-slate-900" aria-live="off">{fmt(running ? left : minutes * 60)}</p>
        {!running && (
          <div className="mb-5 flex justify-center gap-2" role="radiogroup" aria-label="Session length">
            {LENGTHS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={m === minutes} onClick={() => setMinutes(m)} className={`rounded-full px-4 py-2 text-sm font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${m === minutes ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {m}m
              </button>
            ))}
          </div>
        )}
        {running ? (
          <button type="button" onClick={() => setEndsAt(null)} className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 hover:bg-slate-200">
            <Square size={15} strokeWidth={2.5} /> Stop
          </button>
        ) : (
          <button ref={startRef} type="button" onClick={start} className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700">
            <Play size={15} strokeWidth={2.5} /> Start focus
          </button>
        )}
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-xl py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Close</button>
      </div>
    </Modal>
  );
}
