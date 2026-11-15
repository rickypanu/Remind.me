import React from "react";
import { Flame, Plus, X } from "lucide-react";
import { ALERT_CHOICES, MAX_STEPS, newStepId } from "../utils/taskExtras";

const chip = (on) =>
  `rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95 ${
    on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:text-blue-700"
  }`;

/**
 * Priority, checklist and alert times, shared by the New and Edit reminder forms.
 * value = { priority: "normal" | "high", subtasks: [{id, text, done}], alertOffsets: null | number[] }
 */
export default function TaskExtrasFields({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const steps = value.subtasks || [];
  const alerts = value.alertOffsets;

  const editStep = (id, patch) => set({ subtasks: steps.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  const toggleAlert = (m) => {
    const cur = alerts || [];
    set({ alertOffsets: cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m] });
  };

  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-1.5 ml-0.5 block text-xs font-medium text-slate-500">Priority</legend>
        <div className="flex gap-2">
          <button type="button" aria-pressed={value.priority !== "high"} onClick={() => set({ priority: "normal" })} className={chip(value.priority !== "high")}>
            Normal
          </button>
          <button type="button" aria-pressed={value.priority === "high"} onClick={() => set({ priority: "high" })} className={`${chip(value.priority === "high")} inline-flex items-center gap-1`}>
            <Flame size={13} strokeWidth={2.5} aria-hidden="true" /> High
          </button>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 ml-0.5 block text-xs font-medium text-slate-500">
          Checklist <span className="font-normal">(optional)</span>
        </legend>
        <ul className="space-y-2">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={!!s.done}
                onChange={(e) => editStep(s.id, { done: e.target.checked })}
                aria-label="Step done"
                className="h-5 w-5 shrink-0 rounded accent-blue-600"
              />
              <input
                type="text"
                value={s.text}
                maxLength={120}
                placeholder="Step"
                aria-label="Step"
                onChange={(e) => editStep(s.id, { text: e.target.value })}
                className="min-h-[40px] min-w-0 flex-1 rounded-xl border border-transparent bg-slate-100/70 px-3 text-sm text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/10"
              />
              <button type="button" onClick={() => set({ subtasks: steps.filter((x) => x.id !== s.id) })} aria-label="Remove step" className="rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                <X size={16} strokeWidth={2.5} />
              </button>
            </li>
          ))}
        </ul>
        {steps.length < MAX_STEPS && (
          <button
            type="button"
            onClick={() => set({ subtasks: [...steps, { id: newStepId(), text: "", done: false }] })}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus size={14} strokeWidth={2.75} aria-hidden="true" /> Add step
          </button>
        )}
      </fieldset>

      <fieldset>
        <legend className="mb-1.5 ml-0.5 block text-xs font-medium text-slate-500">Alerts before it is due</legend>
        <div className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={alerts === null} onClick={() => set({ alertOffsets: null })} className={chip(alerts === null)}>
            Default
          </button>
          {ALERT_CHOICES.map((a) => (
            <button key={a.minutes} type="button" aria-pressed={!!alerts?.includes(a.minutes)} onClick={() => toggleAlert(a.minutes)} className={chip(!!alerts?.includes(a.minutes))}>
              {a.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-slate-500">Default: 1 hour, 10 minutes and 1 minute before. Sent to Telegram and your browser.</p>
      </fieldset>
    </div>
  );
}
