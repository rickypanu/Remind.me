import React, { useMemo, useState } from "react";
import { ArrowUpDown, CheckCircle2, ChevronDown } from "lucide-react";
import TaskCard from "../tasks/TaskCard";
import { COMPLETED_SORTS, sortCompleted } from "./buckets";

/** Collapsible archive of finished reminders with a sort control. */
export default function CompletedArchive({ tasks, cardProps }) {
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState("date-desc");
  const sorted = useMemo(() => sortCompleted(tasks, sort), [tasks, sort]);
  if (tasks.length === 0) return null;

  return (
    <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden transition-all duration-300">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls="completed-list"
        className="w-full flex items-center justify-between p-4 px-5 bg-slate-50/60 hover:bg-slate-100/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-sm">
            <CheckCircle2 size={18} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <div className="text-left">
            <span className="text-xs font-bold text-slate-900 block leading-tight">Completed archive</span>
            <span className="text-[11px] text-slate-500 font-medium">
              {tasks.length} {tasks.length === 1 ? "task finished" : "tasks finished"}
            </span>
          </div>
        </div>
        <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-slate-500 shadow-sm border border-slate-100">
          <ChevronDown size={14} strokeWidth={2.5} aria-hidden="true" className={`transition-transform duration-200 ${open ? "rotate-180" : "rotate-0"}`} />
        </div>
      </button>

      {open && (
        <div id="completed-list" className="p-3.5 pt-2 grid gap-2.5 max-h-[45vh] overflow-y-auto border-t border-slate-100">
          <div className="flex justify-end px-1 pb-1">
            <div className="relative group">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                aria-label="Sort completed tasks"
                className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold py-1.5 pl-3 pr-8 rounded-lg outline-none cursor-pointer border border-transparent hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-200"
              >
                {COMPLETED_SORTS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ArrowUpDown size={12} aria-hidden="true" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 group-hover:text-slate-600 pointer-events-none transition-colors" strokeWidth={2.5} />
            </div>
          </div>

          {sorted.map((task) => (
            <TaskCard key={task.id} {...cardProps(task)} isPrevious={true} />
          ))}
        </div>
      )}
    </div>
  );
}
