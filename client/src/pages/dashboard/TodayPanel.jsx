import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle } from "../../components/icons";
import NextDeadline from "./NextDeadline";
import { useI18n } from "../../i18n/index.jsx";

/** Progress ring: plain SVG, one arc. */
function Ring({ pct, size = 84, stroke = 8 }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}%`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-blue-100" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct / 100)}
        className="stroke-blue-600 transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  );
}

/**
 * The dashboard side panel: today's progress, the next deadline, the overdue count and the category list.
 * On a phone it sits above the list as a compact card; on a wide screen it is a sticky column.
 */
export default function TodayPanel({ doneToday, pendingToday, pct, overdue, tasks, categories, catFilter, onCategory, onOverdue }) {
  const { t } = useI18n();
  const total = doneToday + pendingToday;

  return (
    <aside aria-label={t("Today's progress")} className="space-y-4 lg:sticky lg:top-24 lg:self-start">
      {total === 0 && overdue === 0 ? (
        <section className="tp-empty relative overflow-hidden rounded-[26px] bg-white p-5 text-center shadow-[0_1px_2px_rgba(20,22,31,.04),0_10px_30px_-12px_rgba(20,22,31,.12)]">
          <span aria-hidden="true" className="tp-dot tp-dot--a" />
          <span aria-hidden="true" className="tp-dot tp-dot--b" />
          <span aria-hidden="true" className="tp-dot tp-dot--c" />
          <span aria-hidden="true" className="tp-dot tp-dot--d" />
          <svg viewBox="0 0 64 64" width="72" height="72" aria-hidden="true" className="tp-bell mx-auto">
            <path d="M32 8c-9 0-15 7-15 16v9l-5 8h40l-5-8v-9c0-9-6-16-15-16Z" className="fill-blue-600" />
            <path d="M25 47a7 7 0 0 0 14 0Z" className="fill-blue-400" />
            <circle cx="32" cy="8" r="3" className="fill-blue-600" />
          </svg>
          <h2 className="mt-3 text-[19px] font-bold leading-tight tracking-tight text-slate-900">{t("A fresh day. Make it count.")}</h2>
          <p className="mx-auto mt-1.5 max-w-[22ch] text-[13.5px] font-medium leading-snug text-slate-600">{t("Your day is a blank page. Let's fill it.")}</p>
          <Link
            to="/create-task"
            className="tp-cta mt-4 inline-flex items-center justify-center rounded-full bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {t("Add a reminder")}
          </Link>
        </section>
      ) : (
      <section className="rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(20,22,31,.04),0_10px_30px_-12px_rgba(20,22,31,.12)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("Today's progress")}</p>
        <div className="mt-3 flex items-center gap-4">
          <div className="relative">
            <Ring pct={pct} />
            <span data-no-translate className="absolute inset-0 flex items-center justify-center text-[17px] font-bold text-slate-900">{pct}%</span>
          </div>
          <div className="min-w-0">
            <p data-no-translate className="text-2xl font-bold leading-none tracking-tight text-slate-900">
              {doneToday}<span className="text-base font-semibold text-slate-400"> / {total}</span>
            </p>
            <p className="mt-1.5 text-[13px] font-medium text-slate-600">
              {total ? t("{done} of {total} done", { done: doneToday, total }) : t("Nothing due today")}
            </p>
          </div>
        </div>
        {overdue > 0 && (
          <button
            type="button"
            onClick={onOverdue}
            className="mt-4 flex w-full items-center gap-2.5 rounded-2xl bg-rose-50 px-3.5 py-2.5 text-left text-[13px] font-semibold text-rose-800 hover:bg-rose-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <AlertCircle size={16} strokeWidth={2.5} aria-hidden="true" className="shrink-0" />
            <span data-no-translate>{overdue}</span>
            <span>{overdue === 1 ? t("item needs attention") : t("items need attention")}</span>
          </button>
        )}
      </section>
      )}

      <NextDeadline tasks={tasks} />

      {categories.length > 0 && (
        <section className="hidden rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(20,22,31,.04),0_10px_30px_-12px_rgba(20,22,31,.12)] lg:block">
          <p className="px-2.5 pb-1.5 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{t("Categories")}</p>
          <ul className="space-y-0.5">
            {[{ name: null, count: categories.reduce((n, c) => n + c.count, 0) }, ...categories].map((c) => {
              const on = catFilter === c.name;
              return (
                <li key={c.name ?? "all"}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => onCategory(c.name)}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-[13.5px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                      on ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <span data-no-translate={c.name ? "" : undefined} className="truncate">{c.name ?? t("All")}</span>
                    <span className={`text-xs font-bold ${on ? "text-white/80" : "text-slate-400"}`}>{c.count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </aside>
  );
}
