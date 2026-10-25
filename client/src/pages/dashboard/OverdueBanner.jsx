import React, { useState } from "react";
import { AlertCircle, ChevronDown } from "lucide-react";
import TaskCard from "../tasks/TaskCard";

/** Collapsible list of reminders whose time has passed. Renders nothing when there are none. */
export default function OverdueBanner({ tasks, cardProps }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  return (
    <div className="mb-6 bg-white rounded-[24px] border border-rose-100 shadow-[0_4px_20px_rgb(244,63,94,0.04)] overflow-hidden transition-all duration-200">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="overdue-list"
        className="w-full flex items-center justify-between p-4 bg-rose-50/50 hover:bg-rose-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-300"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
            <AlertCircle size={16} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-rose-900 block leading-tight">Overdue tasks</span>
            <span className="text-[11px] text-rose-700 font-medium">
              {tasks.length} {tasks.length === 1 ? "item needs" : "items need"} attention
            </span>
          </div>
        </div>
        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
          <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" className={`transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
        </div>
      </button>

      {open && (
        <div id="overdue-list" className="p-3 pt-1 grid gap-2.5 max-h-[40vh] overflow-y-auto border-t border-rose-100/60">
          {tasks.map((task) => (
            <TaskCard key={task.id} {...cardProps(task)} isPrevious={false} />
          ))}
        </div>
      )}
    </div>
  );
}
