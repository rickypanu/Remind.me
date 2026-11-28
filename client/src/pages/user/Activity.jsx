import React, { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, CalendarDays, Clock, AlertCircle, ChevronRight } from "../../components/icons";
import AppPage from "../../components/AppPage";
import useNotificationFeed from "../../hooks/useNotificationFeed";
import usePageMeta from "../../utils/usePageMeta";
import { istDateKey } from "../../utils/date";
import { useI18n } from "../../i18n";

const ICON = { week: CalendarDays, soon: Clock, missed: AlertCircle };
const TONE = { week: "bg-blue-50 text-blue-600", soon: "bg-amber-50 text-amber-600", missed: "bg-rose-50 text-rose-600" };

function bodyOf(x, t) {
  if (x.kind === "week") {
    const line = t("{n} due this coming week", { n: x.week });
    return x.overdue ? `${line}, ${t("{n} overdue", { n: x.overdue })}.` : `${line}.`;
  }
  if (x.kind === "soon") return t("Due in {n} min", { n: x.mins });
  return t("You missed this one");
}

/** Every notification the bell has, newest first, grouped into Today and Earlier. The bell itself only shows today's. */
export default function Activity() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  usePageMeta({ title: "All notifications", description: "Everything GetRemindMe has told you recently.", noindex: true });
  const { items, markAllSeen } = useNotificationFeed(true);
  React.useEffect(() => { const id = setTimeout(markAllSeen, 800); return () => clearTimeout(id); }, [markAllSeen]);

  const groups = useMemo(() => {
    const key = istDateKey(Date.now());
    const today = items.filter((x) => x.kind === "soon" || istDateKey(x.at) === key);
    const earlier = items.filter((x) => !today.includes(x));
    return [
      { id: "today", label: t("Today"), list: today },
      { id: "earlier", label: t("Earlier"), list: earlier },
    ].filter((g) => g.list.length);
  }, [items, t]);

  const when = (x) => new Date(x.at).toLocaleString(locale, { weekday: "short", hour: "numeric", minute: "2-digit" });

  return (
    <AppPage
      title={t("Notifications")}
      subtitle={t("What GetRemindMe has told you lately.")}
      backTo="/u"
      backLabel={t("Dashboard")}
      actions={<Link to="/notifications" className="text-sm font-bold text-blue-700 hover:underline">{t("Settings")}</Link>}
    >
      {groups.length === 0 ? (
        <div className="rounded-[24px] bg-white px-6 py-14 text-center shadow-[0_1px_2px_rgba(20,22,31,.04),0_10px_30px_-12px_rgba(20,22,31,.12)]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Bell size={22} /></span>
          <h2 className="mt-3 text-base font-bold text-slate-900">{t("You are all caught up.")}</h2>
          <p className="mt-1 text-sm text-slate-500">{t("New alerts show up here.")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.id} aria-label={g.label}>
              <h2 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{g.label}</h2>
              <ul className="overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(20,22,31,.04),0_10px_30px_-12px_rgba(20,22,31,.12)]">
                {g.list.map((x) => {
                  const Icon = ICON[x.kind];
                  return (
                    <li key={x.id} className="border-b border-slate-100 last:border-0">
                      <button type="button" onClick={() => navigate("/u")} className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50">
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${TONE[x.kind]}`}><Icon size={18} strokeWidth={2.4} /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-bold text-slate-900" {...(x.kind === "week" ? {} : { "data-no-translate": true })}>{x.kind === "week" ? t(x.title) : x.title}</span>
                          <span className="block text-[13px] text-slate-500">{bodyOf(x, t)}</span>
                        </span>
                        <span className="shrink-0 text-xs font-medium text-slate-400" data-no-translate>{when(x)}</span>
                        <ChevronRight size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </AppPage>
  );
}
