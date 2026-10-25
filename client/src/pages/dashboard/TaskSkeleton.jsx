import React from "react";

/** Placeholder card shown while the reminders load. */
export default function TaskSkeleton() {
  return (
    <div className="p-5 rounded-[24px] border border-slate-100 bg-white animate-pulse flex gap-4">
      <div className="w-6 h-6 rounded-full bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-3 w-24 rounded bg-slate-100" />
        <div className="h-4 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}
