import React from "react";
import { Layers, List } from "lucide-react";

/** "All" plus one chip per category in use, and a switch between one list and groups by category. */
export default function CategoryBar({ categories, value, onChange, grouped, onToggleGrouped }) {
  if (!categories.length) return null;
  const total = categories.reduce((n, c) => n + c.count, 0);
  const chip = (id, label, count) => {
    const on = value === id;
    return (
      <button
        key={id ?? "all"}
        type="button"
        aria-pressed={on}
        onClick={() => onChange(id)}
        className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95 ${
          on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"
        }`}
      >
        <span data-no-translate={id ? "" : undefined}>{label}</span>
        <span className={`text-xs font-bold ${on ? "text-white/80" : "text-slate-500"}`}>{count}</span>
      </button>
    );
  };
  return (
    <div className="mb-4 flex items-center gap-2">
      <div className="scrollbar-hide -mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-0.5">
        {chip(null, "All", total)}
        {categories.map((c) => chip(c.name, c.name, c.count))}
      </div>
      <button
        type="button"
        onClick={onToggleGrouped}
        aria-pressed={grouped}
        aria-label={grouped ? "Show as one list" : "Group by category"}
        title={grouped ? "Show as one list" : "Group by category"}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
          grouped ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:text-slate-900"
        }`}
      >
        {grouped ? <List size={17} strokeWidth={2.4} /> : <Layers size={17} strokeWidth={2.4} />}
      </button>
    </div>
  );
}
