import React from "react";
import TaskCard from "../tasks/TaskCard";

/** Reminders in labelled groups ("Tomorrow", "Mon, 26 Oct", ...): one heading per day, cards under it. */
export default function TaskGroups({ groups, cardProps }) {
  return (
    <div className="grid gap-6">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`group-${group.key}`}>
          <h2
            id={`group-${group.key}`}
            className="mb-2.5 px-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-slate-500"
          >
            {group.label}
            <span className="px-1.5 py-0.5 rounded-full bg-slate-300/40 text-[10px] text-slate-600 normal-case tracking-normal">
              {group.tasks.length}
            </span>
          </h2>
          <div className="grid gap-3">
            {group.tasks.map((task) => (
              <TaskCard key={task.id} {...cardProps(task)} isPrevious={false} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
