import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee, Sun, CalendarDays, X, Search, Download } from "lucide-react";
import { APP_TIMEZONE, formatDueIst, formatIstDayLabel, getIstHour, istDateKey } from "../../utils/date";
import TaskCard from "../tasks/TaskCard";
import Header from "../components/Header";
import notify from "../../utils/notify";
import { isLoggedIn } from "../../utils/auth";
import usePageMeta from "../../utils/usePageMeta";
import useOfflineTasks from "../../offline/useOfflineTasks";
import useMe, { userIdOf } from "../../hooks/useMe";
import useDashboardTasks from "../../hooks/useDashboardTasks";
import useTaskStats from "../../hooks/useTaskStats";
import { filterByIstDate, greetingForHour } from "./buckets";
import CompletedArchive from "./CompletedArchive";
import DashboardTabs from "./DashboardTabs";
import CalendarPopover from "./CalendarPopover";
import CategoryBar from "../../components/CategoryBar";
import { categoryCounts, dayCounts, downloadText, exportText, groupByCategory } from "../../utils/taskExtras";
import EmptyState from "./EmptyState";
import MagicAddForm from "./MagicAddForm";
import InstallBanner from "../../components/InstallBanner";
import NextDeadline from "./NextDeadline";
import MotivationCard from "./MotivationCard";
import { effectiveStreak } from "./motivation";
import TaskGroups from "./TaskGroups";
import OverdueBanner from "./OverdueBanner";
import TaskSkeleton from "./TaskSkeleton";
import { useI18n } from "../../i18n/index.jsx";

const EMPTY_STATES = {
  today: { Icon: Coffee, title: "Nothing due today", body: "You're all caught up. Enjoy your break!", cta: "Add a reminder" },
  upcoming: { Icon: CalendarDays, title: "Nothing planned yet", body: "Add a reminder to plan ahead.", cta: "Add a reminder" },
};

const savedOfflineNote = (t) => (navigator.onLine ? "" : " " + t("Saved on this device."));

export default function Dashboard() {
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  usePageMeta({
    title: "Dashboard",
    description: "Your reminders for today and upcoming days, including daily and weekly repeats.",
    noindex: true,
  });

  const [activeTab, setActiveTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD" (an IST day) or null
  const [catFilter, setCatFilter] = useState(null);
  const [grouped, setGrouped] = useState(false);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Auth guard (expired sessions are handled globally by the API client)
  useEffect(() => {
    if (!isLoggedIn()) navigate("/login", { replace: true });
  }, [navigate]);

  // Profile: network first, then the copy saved on this device (so the greeting works offline)
  const me = useMe();
  const userInfo = me.data || null;
  const userId = me.isPending ? undefined : userIdOf(userInfo);

  // Reminders: read from IndexedDB, written to IndexedDB first, uploaded in the background
  const { tasks, ready, toggleTask, editTask, removeTask } = useOfflineTasks(userId);
  const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
  const { missed, today, upcoming, upcomingGroups, completed, doneTodayCount } = useDashboardTasks(tasks);
  const stats = useTaskStats({ enabled: !!userId && !isOffline });

  const handleToggle = useCallback(
    async (task) => {
      const result = await toggleTask(task);
      const next = result?.task;
      if (next) {
        let message = next.status === "completed" ? t("Task marked complete!") : t("Task moved back to pending");
        if (next.schedule_type !== "once" && task.status !== "completed") {
          message =
            next.status === "pending" && next.due_date
              ? `Done! Next reminder: ${formatDueIst(next.due_date)} IST`
              : "Done! That was the last reminder in this series.";
        }
        notify.success(message + savedOfflineNote(t));
      }
      return result;
    },
    [toggleTask, t]
  );

  const handleDelete = useCallback(
    async (task) => {
      await removeTask(task);
      notify.success(t("Reminder deleted.") + savedOfflineNote(t));
    },
    [removeTask, t]
  );

  const cardProps = (task) => ({ task, onToggle: handleToggle, onDelete: handleDelete, onEdit: editTask });

  const greeting = useMemo(() => greetingForHour(getIstHour()), []);
  const tabs = useMemo(
    () => [
      { id: "today", label: t("Today"), count: today.length, icon: Sun },
      { id: "upcoming", label: t("Upcoming"), count: upcoming.length, icon: CalendarDays },
    ],
    [today.length, upcoming.length, t]
  );
  const categories = useMemo(() => categoryCounts(tasks), [tasks]);
  useEffect(() => {
    if (catFilter && !categories.some((c) => c.name === catFilter)) setCatFilter(null);
  }, [categories, catFilter]);
  const byCat = useCallback((list) => (catFilter ? list.filter((x) => x.category === catFilter) : list), [catFilter]);
  const titles = useMemo(() => [...new Set(tasks.map((x) => x.title).filter(Boolean))].slice(0, 200), [tasks]);
  const counts = useMemo(() => dayCounts(tasks), [tasks]);
  const needle = query.trim().toLowerCase();
  const searchHits = useMemo(() => {
    if (!searching || !needle) return [];
    return byCat(tasks.filter((x) => !x.deleted && `${x.title} ${x.category || ""} ${x.description || ""}`.toLowerCase().includes(needle)))
      .filter((x) => (statusFilter === "done" ? x.status === "completed" : statusFilter === "pending" ? x.status !== "completed" : true));
  }, [searching, needle, tasks, byCat, statusFilter]);
  const displayedTasks = byCat(activeTab === "upcoming" ? upcoming : today);
  const filteredUpcomingGroups = useMemo(
    () => (grouped ? [] : upcomingGroups.map((g) => ({ ...g, tasks: byCat(g.tasks) })).filter((g) => g.tasks.length)),
    [upcomingGroups, byCat, grouped]
  );
  const empty = EMPTY_STATES[activeTab];

  // Calendar filter: every reminder due on the picked IST day, replacing the Today / Upcoming list until cleared.
  const dateLabel = useMemo(() => (selectedDate ? formatIstDayLabel(selectedDate) : ""), [selectedDate]);
  const dateMatches = useMemo(() => (selectedDate ? byCat(filterByIstDate(tasks, selectedDate)) : []), [tasks, selectedDate, byCat]);
  const dateGroups = useMemo(() => [{ key: "picked", label: dateLabel, tasks: dateMatches }], [dateLabel, dateMatches]);
  const changeTab = useCallback((id) => {
    setSelectedDate(null); // choosing Today / Upcoming leaves the date filter
    setActiveTab(id);
  }, []);

  // Motivation card inputs
  const dayKey = istDateKey();
  const motivation = useMemo(() => {
    const localDone = Math.max(doneTodayCount, 0);
    const serverToday = stats.data?.completed_today ?? 0;
    return {
      streak: effectiveStreak(stats.data, localDone),
      bestStreak: stats.data?.best_streak ?? 0,
      doneToday: Math.max(localDone, serverToday),
    };
  }, [stats.data, doneTodayCount]);

  return (
    <div className="min-h-screen bg-[color:var(--rm-page)] pb-28 text-slate-900 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif] relative overflow-x-hidden">
      <Header />

      <main id="main" className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Greeting */}
        <div className="pt-7 pb-5">
          <p className="text-sm font-medium text-slate-500 mb-1">
            {new Date().toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", timeZone: APP_TIMEZONE })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight text-balance">
            {t(greeting)},{" "}
            <span data-no-translate className="text-blue-600 font-semibold">{userInfo?.username ? userInfo.username.split(" ")[0] : t("there")}</span>
          </h1>
        </div>

        <NextDeadline tasks={tasks} />

        <MagicAddForm isOffline={isOffline} titles={titles} />

        <InstallBanner />

        <MotivationCard
          name={userInfo?.username}
          userId={userId || undefined}
          dayKey={dayKey}
          hour={getIstHour()}
          streak={motivation.streak}
          bestStreak={motivation.bestStreak}
          doneToday={motivation.doneToday}
          pendingToday={today.length}
          overdue={missed.length}
        />

        <OverdueBanner tasks={byCat(missed)} cardProps={cardProps} />

        <div className="mb-6 flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <DashboardTabs tabs={tabs} active={selectedDate ? null : activeTab} onChange={changeTab} panelId="task-panel" />
          </div>
          <CalendarPopover value={selectedDate} label={dateLabel} counts={counts} onChange={setSelectedDate} />
          <button
            type="button"
            onClick={() => { setSearching((x) => !x); setQuery(""); }}
            aria-pressed={searching}
            aria-label={t("Search reminders")}
            title={t("Search reminders")}
            className={`min-w-[48px] self-stretch rounded-2xl border px-3 flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${searching ? "bg-blue-600 border-blue-600 text-white" : "bg-slate-200/60 border-transparent text-slate-600 hover:text-slate-900"}`}
          >
            <Search size={19} strokeWidth={2.25} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => downloadText("deadline-reminders.txt", exportText(tasks))}
            aria-label={t("Export my reminders")}
            title={t("Export my reminders")}
            className="min-w-[48px] self-stretch rounded-2xl border border-transparent bg-slate-200/60 px-3 flex items-center justify-center text-slate-600 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Download size={19} strokeWidth={2.25} aria-hidden="true" />
          </button>
        </div>

        {searching && (
          <div className="mb-4">
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Search your reminders…")}
              aria-label={t("Search your reminders…")}
              className="min-h-[46px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] text-slate-900 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10"
            />
            <div className="mt-2 flex gap-2">
              {[["all", "All"], ["pending", "To do"], ["done", "Done"]].map(([id, label]) => (
                <button key={id} type="button" aria-pressed={statusFilter === id} onClick={() => setStatusFilter(id)} className={`h-8 rounded-full px-3.5 text-[13px] font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${statusFilter === id ? "bg-blue-600 text-white" : "bg-slate-200/60 text-slate-600"}`}>
                  {t(label)}
                </button>
              ))}
            </div>
          </div>
        )}

        <CategoryBar categories={categories} value={catFilter} onChange={setCatFilter} grouped={grouped} onToggleGrouped={() => setGrouped((g) => !g)} />

        {selectedDate && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5">
            <p className="min-w-0 text-xs font-semibold text-blue-900" role="status">
              {t("Showing reminders for")} <span className="font-bold">{dateLabel}</span> · {dateMatches.length}
            </p>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={12} strokeWidth={3} aria-hidden="true" />
              {t("Clear")}
            </button>
          </div>
        )}

        <div
          id="task-panel"
          role="tabpanel"
          {...(selectedDate ? { "aria-label": t("Reminders for {date}", { date: dateLabel }) } : { "aria-labelledby": `tab-${activeTab}` })}
          tabIndex={-1}
        >
          {!ready ? (
            <div className="grid gap-3 mb-8" aria-busy="true" aria-label={t("Loading tasks")}>
              <TaskSkeleton />
              <TaskSkeleton />
              <TaskSkeleton />
            </div>
          ) : searching && needle ? (
            <div className="mb-8">
              {searchHits.length === 0 ? (
                <EmptyState Icon={Search} title={t("No matches")} body={t("Try a different word.")} cta={t("Add a reminder")} />
              ) : (
                <TaskGroups groups={[{ key: "search", label: `${searchHits.length} ${t("found")}`, tasks: searchHits }]} cardProps={cardProps} />
              )}
            </div>
          ) : grouped && !selectedDate ? (
            <div className="mb-8">
              {displayedTasks.length === 0 && activeTab === "today" ? (
                <EmptyState Icon={empty.Icon} title={t(empty.title)} body={t(empty.body)} cta={t(empty.cta)} />
              ) : (
                <TaskGroups groups={groupByCategory(activeTab === "upcoming" ? byCat(upcoming) : displayedTasks)} cardProps={cardProps} />
              )}
            </div>
          ) : selectedDate ? (
            <div className="mb-8">
              {dateMatches.length === 0 ? (
                <EmptyState Icon={CalendarDays} title={t("Nothing on {date}", { date: dateLabel })} body={t("No reminders are set for that day.")} cta={t("Add a reminder")} />
              ) : (
                <TaskGroups groups={dateGroups} cardProps={cardProps} />
              )}
            </div>
          ) : activeTab === "upcoming" && filteredUpcomingGroups.length > 0 ? (
            <div className="mb-8">
              <TaskGroups groups={filteredUpcomingGroups} cardProps={cardProps} />
            </div>
          ) : (
            <div className="grid gap-3 mb-8">
              {displayedTasks.length === 0 ? (
                <EmptyState Icon={empty.Icon} title={t(empty.title)} body={t(empty.body)} cta={t(empty.cta)} />
              ) : (
                displayedTasks.map((task) => <TaskCard key={task.id} {...cardProps(task)} isPrevious={false} />)
              )}
            </div>
          )}
        </div>

        <CompletedArchive tasks={completed} cardProps={cardProps} />
      </main>
    </div>
  );
}
