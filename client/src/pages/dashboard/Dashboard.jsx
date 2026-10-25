import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee, Sun, CalendarDays, X } from "lucide-react";
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
import DateFilterButton from "./DateFilterButton";
import EmptyState from "./EmptyState";
import MagicAddForm from "./MagicAddForm";
import MotivationCard from "./MotivationCard";
import { effectiveStreak } from "./motivation";
import TaskGroups from "./TaskGroups";
import OverdueBanner from "./OverdueBanner";
import TaskSkeleton from "./TaskSkeleton";

const EMPTY_STATES = {
  today: { Icon: Coffee, title: "Nothing due today", body: "You're all caught up. Enjoy your break!", cta: "Add a reminder" },
  upcoming: { Icon: CalendarDays, title: "Nothing planned yet", body: "Add a reminder to plan ahead.", cta: "Add a reminder" },
};

const savedOfflineNote = () => (navigator.onLine ? "" : " Saved on this device.");

export default function Dashboard() {
  const navigate = useNavigate();
  usePageMeta({
    title: "Dashboard",
    description: "Your reminders for today and upcoming days, including daily and weekly repeats.",
    noindex: true,
  });

  const [activeTab, setActiveTab] = useState("today");
  const [selectedDate, setSelectedDate] = useState(null); // "YYYY-MM-DD" (an IST day) or null

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
        let message = next.status === "completed" ? "Task marked complete!" : "Task moved back to pending";
        if (next.schedule_type !== "once" && task.status !== "completed") {
          message =
            next.status === "pending" && next.due_date
              ? `Done! Next reminder: ${formatDueIst(next.due_date)} IST`
              : "Done! That was the last reminder in this series.";
        }
        notify.success(message + savedOfflineNote());
      }
      return result;
    },
    [toggleTask]
  );

  const handleDelete = useCallback(
    async (task) => {
      await removeTask(task);
      notify.success("Reminder deleted." + savedOfflineNote());
    },
    [removeTask]
  );

  const cardProps = (task) => ({ task, onToggle: handleToggle, onDelete: handleDelete, onEdit: editTask });

  const greeting = useMemo(() => greetingForHour(getIstHour()), []);
  const tabs = useMemo(
    () => [
      { id: "today", label: "Today", count: today.length, icon: Sun },
      { id: "upcoming", label: "Upcoming", count: upcoming.length, icon: CalendarDays },
    ],
    [today.length, upcoming.length]
  );
  const displayedTasks = activeTab === "upcoming" ? upcoming : today;
  const empty = EMPTY_STATES[activeTab];

  // Calendar filter: every reminder due on the picked IST day, replacing the Today / Upcoming list until cleared.
  const dateLabel = useMemo(() => (selectedDate ? formatIstDayLabel(selectedDate) : ""), [selectedDate]);
  const dateMatches = useMemo(() => (selectedDate ? filterByIstDate(tasks, selectedDate) : []), [tasks, selectedDate]);
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
        <div className="pt-10 pb-6">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: APP_TIMEZONE })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight text-balance">
            {greeting},{" "}
            <span className="text-blue-600 font-semibold">{userInfo?.username ? userInfo.username.split(" ")[0] : "there"}</span>
          </h1>
        </div>

        <MagicAddForm isOffline={isOffline} />

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

        <OverdueBanner tasks={missed} cardProps={cardProps} />

        <div className="mb-6 flex items-stretch gap-2">
          <div className="min-w-0 flex-1">
            <DashboardTabs tabs={tabs} active={selectedDate ? null : activeTab} onChange={changeTab} panelId="task-panel" />
          </div>
          <DateFilterButton value={selectedDate} label={dateLabel} onChange={setSelectedDate} />
        </div>

        {selectedDate && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-2.5">
            <p className="min-w-0 text-xs font-semibold text-blue-900" role="status">
              Showing reminders for <span className="font-bold">{dateLabel}</span> · {dateMatches.length}
            </p>
            <button
              type="button"
              onClick={() => setSelectedDate(null)}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-sm hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <X size={12} strokeWidth={3} aria-hidden="true" />
              Clear
            </button>
          </div>
        )}

        <div
          id="task-panel"
          role="tabpanel"
          {...(selectedDate ? { "aria-label": `Reminders for ${dateLabel}` } : { "aria-labelledby": `tab-${activeTab}` })}
          tabIndex={-1}
        >
          {!ready ? (
            <div className="grid gap-3 mb-8" aria-busy="true" aria-label="Loading tasks">
              <TaskSkeleton />
              <TaskSkeleton />
              <TaskSkeleton />
            </div>
          ) : selectedDate ? (
            <div className="mb-8">
              {dateMatches.length === 0 ? (
                <EmptyState Icon={CalendarDays} title={`Nothing on ${dateLabel}`} body="No reminders are set for that day." cta="Add a reminder" />
              ) : (
                <TaskGroups groups={dateGroups} cardProps={cardProps} />
              )}
            </div>
          ) : activeTab === "upcoming" && upcomingGroups.length > 0 ? (
            <div className="mb-8">
              <TaskGroups groups={upcomingGroups} cardProps={cardProps} />
            </div>
          ) : (
            <div className="grid gap-3 mb-8">
              {displayedTasks.length === 0 ? (
                <EmptyState {...empty} />
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
