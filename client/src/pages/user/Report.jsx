import React, { useEffect, useMemo, useState } from "react";
import { Download } from "../../components/icons";
import AppPage from "../../components/AppPage";
import usePageMeta from "../../utils/usePageMeta";
import useMe from "../../hooks/useMe";
import { getAllTasks, subscribeTasks } from "../../offline/db";
import { istDateKey, istDayRangeFromKey, parseDueDate, formatDueIst } from "../../utils/date";
import { useI18n } from "../../i18n";

const DAY = 24 * 3600 * 1000;
const PRESETS = [
  { id: "day", label: "Last day", days: 1 },
  { id: "week", label: "Last week", days: 7 },
  { id: "month", label: "Last month", days: 30 },
  { id: "year", label: "Last year", days: 365 },
];

const keyDaysAgo = (n) => istDateKey(Date.now() - n * DAY);

/**
 * Progress report for any period: pick from/to dates or a quick range, see the numbers, then "Download PDF".
 * The PDF is made by the browser's own print engine (Save as PDF), so every language and font prints correctly.
 */
export default function Report() {
  const { t } = useI18n();
  usePageMeta({ title: "Report", description: "A progress report of your reminders for any period.", noindex: true });
  const me = useMe();
  const [tasks, setTasks] = useState([]);
  const [preset, setPreset] = useState("week");
  const [from, setFrom] = useState(keyDaysAgo(6));
  const [to, setTo] = useState(istDateKey());

  useEffect(() => {
    let alive = true;
    const load = () => getAllTasks().then((all) => alive && setTasks(all.filter((x) => !x.deleted && x.syncAction !== "delete"))).catch(() => {});
    load();
    const off = subscribeTasks(load);
    return () => { alive = false; off(); };
  }, []);

  const pick = (p) => {
    setPreset(p.id);
    setFrom(keyDaysAgo(p.days - 1));
    setTo(istDateKey());
  };
  const edit = (setter) => (e) => { setPreset("custom"); setter(e.target.value); };

  const range = useMemo(() => {
    const a = istDayRangeFromKey(from);
    const b = istDayRangeFromKey(to);
    if (!a || !b) return null;
    return a.start <= b.end ? { start: a.start, end: b.end } : { start: b.start, end: a.end };
  }, [from, to]);

  const report = useMemo(() => {
    if (!range) return null;
    const now = Date.now();
    const rows = [];
    for (const x of tasks) {
      const due = parseDueDate(x.due_date);
      if (!due) continue;
      const ms = due.getTime();
      if (ms < range.start || ms > range.end) continue;
      const status = x.status === "completed" ? "done" : ms < now ? "missed" : "pending";
      rows.push({ id: x.id || x.clientId, title: x.title, category: x.category || "Other", due: x.due_date, ms, status });
    }
    rows.sort((p, q) => p.ms - q.ms);
    const count = (s) => rows.filter((r) => r.status === s).length;
    const byCat = {};
    for (const r of rows) {
      const c = (byCat[r.category] ||= { name: r.category, total: 0, done: 0 });
      c.total += 1;
      if (r.status === "done") c.done += 1;
    }
    return {
      rows,
      total: rows.length,
      done: count("done"),
      missed: count("missed"),
      pending: count("pending"),
      rate: rows.length ? Math.round((count("done") / rows.length) * 100) : 0,
      cats: Object.values(byCat).sort((p, q) => q.total - p.total),
    };
  }, [tasks, range]);

  const statusLabel = { done: t("Done"), missed: t("Missed"), pending: t("Pending") };
  const name = me.data?.username || "";
  const fileName = `GetRemindMe-report-${from}-to-${to}`;

  const download = () => {
    const prev = document.title;
    document.title = fileName; // becomes the default file name in "Save as PDF"
    const restore = () => { document.title = prev; window.removeEventListener("afterprint", restore); };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const input = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/15";

  return (
    <AppPage title={t("Report")} subtitle={t("Pick a period and download it as a PDF.")} backTo="/profile" backLabel={t("Profile")}>
      <div className="no-print space-y-4">
        <div role="radiogroup" aria-label={t("Quick range")} className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={preset === p.id}
              onClick={() => pick(p)}
              className={`h-10 rounded-full px-4 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${preset === p.id ? "bg-blue-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
            >
              {t(p.label)}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-[13px] font-bold text-slate-600">
            {t("From")}
            <input type="date" value={from} max={to} onChange={edit(setFrom)} className={`${input} mt-1`} />
          </label>
          <label className="block text-[13px] font-bold text-slate-600">
            {t("To")}
            <input type="date" value={to} min={from} max={istDateKey()} onChange={edit(setTo)} className={`${input} mt-1`} />
          </label>
        </div>
      </div>

      {!report ? (
        <p className="mt-6 text-sm text-slate-500">{t("Choose a valid period.")}</p>
      ) : (
        <>
          <article className="report-sheet mt-6 rounded-[24px] bg-white p-5 shadow-[0_1px_2px_rgba(20,22,31,.04),0_10px_30px_-12px_rgba(20,22,31,.12)] sm:p-7">
            <div className="border-b border-slate-100 pb-4">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-700">GetRemindMe</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{t("Progress report")}</h2>
              <p className="mt-1 text-sm text-slate-500" data-no-translate>
                {name && `${name} · `}{from} → {to}
              </p>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [t("Reminders"), report.total],
                [t("Done"), report.done],
                [t("Missed"), report.missed],
                [t("Completion"), `${report.rate}%`],
              ].map(([k, v]) => (
                <div key={k} className="rounded-2xl bg-slate-50 px-4 py-3">
                  <dt className="text-xs font-semibold text-slate-500">{k}</dt>
                  <dd className="mt-0.5 text-2xl font-bold text-slate-900" data-no-translate>{v}</dd>
                </div>
              ))}
            </dl>

            {report.cats.length > 0 && (
              <section className="mt-6">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("By category")}</h3>
                <ul className="mt-2 space-y-2">
                  {report.cats.map((c) => (
                    <li key={c.name} className="flex items-center gap-3 text-sm">
                      <span className="w-40 shrink-0 truncate font-semibold text-slate-800" data-no-translate>{c.name}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-600" style={{ width: `${Math.round((c.done / c.total) * 100)}%` }} /></span>
                      <span className="w-14 shrink-0 text-right font-semibold text-slate-600" data-no-translate>{c.done}/{c.total}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-6">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t("All reminders in this period")}</h3>
              {report.rows.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">{t("No reminders were due in this period.")}</p>
              ) : (
                <table className="report-table mt-2 w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3 font-semibold">{t("Due")}</th>
                      <th className="py-2 pr-3 font-semibold">{t("Reminder")}</th>
                      <th className="py-2 pr-3 font-semibold">{t("Category")}</th>
                      <th className="py-2 font-semibold">{t("Status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 align-top">
                        <td className="whitespace-nowrap py-2 pr-3 text-slate-500" data-no-translate>{formatDueIst(r.due)}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-900" data-no-translate>{r.title}</td>
                        <td className="py-2 pr-3 text-slate-600" data-no-translate>{r.category}</td>
                        <td className={`whitespace-nowrap py-2 font-bold ${r.status === "done" ? "text-emerald-700" : r.status === "missed" ? "text-rose-700" : "text-slate-600"}`}>{statusLabel[r.status]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
            <p className="mt-6 hidden text-xs text-slate-400 print:block" data-no-translate>Generated by GetRemindMe · {istDateKey()}</p>
          </article>

          <button
            type="button"
            onClick={download}
            className="no-print mt-5 flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 text-[15px] font-bold text-white shadow-md shadow-blue-500/25 transition hover:bg-blue-700 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Download size={18} strokeWidth={2.5} aria-hidden="true" /> {t("Download PDF")}
          </button>
          <p className="no-print mt-2 text-center text-xs text-slate-500">{t("In the window that opens, choose “Save as PDF”.")}</p>
        </>
      )}
    </AppPage>
  );
}
