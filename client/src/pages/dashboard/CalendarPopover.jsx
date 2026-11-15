import React, { useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import Modal from "../../components/Modal";
import { istDateKey } from "../../utils/date";
import { monthGrid } from "../../utils/taskExtras";

const NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Calendar button next to the tabs. Opens a month grid with a dot under every day that has a pending reminder. */
export default function CalendarPopover({ value, label, counts, onChange }) {
  const [open, setOpen] = useState(false);
  const today = istDateKey();
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const cells = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const closeRef = useRef(null);
  const step = (d) => setYm(({ y, m }) => { const n = y * 12 + m + d; return { y: Math.floor(n / 12), m: n % 12 }; });
  const pick = (key) => { onChange(key); setOpen(false); };

  return (
    <div className="relative shrink-0 self-stretch">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-pressed={Boolean(value)}
        aria-label={value ? `Filtering reminders by ${label}. Change date` : "Filter reminders by date"}
        title="Pick a date"
        className={`h-full min-w-[52px] px-3 rounded-2xl border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          value ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700" : "bg-slate-200/60 border-transparent text-slate-600 hover:text-slate-900"
        }`}
      >
        <Calendar size={19} strokeWidth={2.25} aria-hidden="true" />
      </button>
      {open && (
        <Modal onClose={() => setOpen(false)} labelledBy="cal-title" initialFocusRef={closeRef}>
          <div className="rm-modal-in w-full max-w-sm rounded-[24px] bg-white p-5 shadow-2xl">
            <div className="mb-3 flex items-center">
              <button type="button" onClick={() => step(-1)} aria-label="Previous month" className="rounded-full p-2 text-blue-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ChevronLeft size={20} /></button>
              <h2 id="cal-title" className="flex-1 text-center text-base font-bold text-slate-900"><span data-no-translate>{NAMES[ym.m]} {ym.y}</span></h2>
              <button type="button" onClick={() => step(1)} aria-label="Next month" className="rounded-full p-2 text-blue-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><ChevronRight size={20} /></button>
            </div>
            <div className="grid grid-cols-7 text-center text-xs font-bold text-slate-500" aria-hidden="true">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="pb-2">{d}</span>)}
            </div>
            <div className="grid grid-cols-7">
              {cells.map((c, i) => {
                if (!c) return <span key={i} />;
                const key = `${ym.y}-${String(ym.m + 1).padStart(2, "0")}-${String(c).padStart(2, "0")}`;
                const n = counts[key] || 0;
                const on = key === value;
                const isToday = key === today;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => pick(key)}
                    aria-label={`${c} ${NAMES[ym.m]}${n ? `, ${n} reminder${n > 1 ? "s" : ""}` : ""}`}
                    className="relative flex h-11 items-center justify-center focus:outline-none"
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-full text-sm tabular-nums ${on ? "bg-blue-600 font-bold text-white" : isToday ? "border-2 border-blue-600 font-bold text-slate-900" : n ? "font-bold text-slate-900 hover:bg-slate-100" : "text-slate-700 hover:bg-slate-100"}`}>{c}</span>
                    {n > 0 && <span aria-hidden="true" className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${on ? "bg-white" : "bg-blue-600"}`} />}
                  </button>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => pick(null)} className="rounded-lg px-2 py-2 text-sm font-semibold text-blue-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Clear date filter</button>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">Close</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
