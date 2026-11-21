import React from "react";
import { Flame, CheckCircle2, Trophy } from "../icons";

function Stat({ icon: Icon, value, label, tone }) {
  return (
    <div className="flex flex-1 items-center gap-3 rounded-2xl border-[1.5px] border-slate-900 bg-white px-4 py-3 shadow-[3px_3px_0_0_#14161f]">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 text-left">
        <span className="block text-2xl font-extrabold leading-none tracking-tight text-slate-900">{value}</span>
        <span className="mt-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </span>
    </div>
  );
}

/** Current streak, best streak and today's completions. Shows dashes while the numbers load or are unavailable. */
export default function StatsStrip({ stats }) {
  const v = (n) => (typeof n === "number" ? n : "–");
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Stat icon={Flame} value={v(stats?.streak)} label="Day streak" tone="bg-amber-100 text-amber-700" />
      <Stat icon={Trophy} value={v(stats?.best_streak)} label="Best streak" tone="bg-blue-100 text-blue-700" />
      <Stat icon={CheckCircle2} value={v(stats?.completed_today)} label="Done today" tone="bg-emerald-100 text-emerald-700" />
    </div>
  );
}
