import React, { useEffect, useMemo, useState } from "react";
import { Timer } from "lucide-react";
import { formatDueIst } from "../../utils/date";
import { useI18n } from "../../i18n/index.jsx";

const DAY = 86400000;

/** "2h 15m", "45m", "3d 4h": the biggest two units, never more. */
export function formatLeft(ms) {
  const mins = Math.max(0, Math.round(Math.abs(ms) / 60000));
  if (mins < 1) return "0m";
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d) return h ? `${d}d ${h}h` : `${d}d`;
  if (h) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m}m`;
}

/**
 * The one number that matters: time left on the closest pending reminder, with a bar that runs down as the
 * deadline gets closer. Ticks once a minute; renders nothing when nothing is pending.
 */
export default function NextDeadline({ tasks }) {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const next = useMemo(() => {
    let best = null;
    for (const task of tasks) {
      if (task.status === "completed" || !task.due_date) continue;
      const due = new Date(task.due_date).getTime();
      if (Number.isNaN(due) || due < now - 3600000) continue; // ignore things already long overdue; the banner shows those
      if (!best || due < best.due) best = { task, due };
    }
    return best;
  }, [tasks, now]);

  if (!next) return null;
  const ms = next.due - now;
  const late = ms < 0;
  const remaining = late ? 0 : Math.min(1, ms / DAY);
  const urgent = !late && ms < 3600000;

  return (
    <section aria-label={t("Next deadline")} className="dl-next mb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="dl-next-label">
            <Timer size={14} strokeWidth={2.5} aria-hidden="true" /> {t("Next deadline")}
          </p>
          <h2 data-no-translate className="dl-next-title">{next.task.title}</h2>
          <p className="dl-next-sub">
            {formatDueIst(next.task.due_date)} IST
          </p>
        </div>
        <div className="text-right shrink-0" role="timer" aria-live="off">
          <p className={`dl-next-time ${urgent || late ? "dl-next-urgent" : ""}`} data-no-translate>{formatLeft(ms)}</p>
          <p className="dl-next-sub">{late ? t("late") : t("left")}</p>
        </div>
      </div>
      <div className="dl-next-bar" aria-hidden="true">
        <span style={{ width: `${Math.round(remaining * 100)}%` }} className={urgent || late ? "dl-next-bar-urgent" : ""} />
      </div>
    </section>
  );
}
