import React, { useState, useEffect, useMemo } from "react";
import api from "../../utils/api";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  BarChart2,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- Utility Functions (Extracted to keep component clean) ---

const formatDate = (date) =>
  date.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const getWeekWindow = (offset) => {
  const now = new Date();
  const date = new Date(now);
  const dayOfWeek = date.getDay();
  const distanceToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  const start = new Date(date);
  start.setDate(date.getDate() - distanceToMonday + offset * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const getTrend = (current, previous) => {
  const diff = current - previous;
  if (diff > 0)
    return {
      type: "up",
      text: `${diff} more than last week`,
      icon: TrendingUp,
      color: "text-emerald-500",
    };
  if (diff < 0)
    return {
      type: "down",
      text: `${Math.abs(diff)} fewer than last week`,
      icon: TrendingDown,
      color: "text-rose-500",
    };
  return {
    type: "neutral",
    text: "Same as last week",
    icon: Minus,
    color: "text-slate-400",
  };
};

// --- Reusable Sub-Components ---

const StatCard = ({ title, icon: Icon, mainValue, subValue, trend }) => (
  <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col justify-between h-52 md:h-auto md:flex-1">
    <div className="flex items-center gap-2 text-slate-500">
      <Icon className="w-5 h-5" />
      <span className="font-medium text-sm">{title}</span>
    </div>
    <div className="mt-4 md:mt-6">
      <div className="text-6xl md:text-7xl font-bold tracking-tighter text-slate-900">
        {mainValue}
      </div>
      {trend ? (
        <div className="flex items-center gap-1 mt-3">
          <trend.icon className={`w-4 h-4 ${trend.color}`} />
          <span className={`text-sm font-medium ${trend.color}`}>
            {trend.text}
          </span>
        </div>
      ) : (
        <div className="text-sm text-slate-400 mt-2 font-medium">
          {subValue}
        </div>
      )}
    </div>
  </div>
);

const Report = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const navigate = useNavigate();

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required. Please log in.");

      const response = await api.get("/tasks/", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!Array.isArray(response.data))
        throw new Error("Invalid data format received.");

      setTasks(response.data);
    } catch (err) {
      console.error("Dashboard Error:", err);
      setError(err.response?.data?.detail || err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const stats = useMemo(() => {
    if (!tasks.length) return null;

    const targetWeek = getWeekWindow(weekOffset);
    const previousWeek = getWeekWindow(weekOffset - 1);

    const filterTasksForWindow = (start, end) =>
      tasks.filter((task) => {
        const taskDate = new Date(task.due_date);
        return taskDate >= start && taskDate <= end;
      });

    const tasksThisWeek = filterTasksForWindow(
      targetWeek.start,
      targetWeek.end,
    );
    const tasksLastWeek = filterTasksForWindow(
      previousWeek.start,
      previousWeek.end,
    );

    const completedThisWeek = tasksThisWeek.filter(
      (t) => t.status === "completed",
    );
    const pendingThisWeek = tasksThisWeek.filter((t) => t.status === "pending");

    const completedLastWeekCount = tasksLastWeek.filter(
      (t) => t.status === "completed",
    ).length;
    const trend = getTrend(completedThisWeek.length, completedLastWeekCount);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let hasActivity = false;

    const dailyData = days.map((dayLabel, index) => {
      const dayDate = new Date(targetWeek.start);
      dayDate.setDate(targetWeek.start.getDate() + index);
      const completedOnDay = completedThisWeek.filter((t) => {
        const d = new Date(t.due_date);
        return (
          d.getDate() === dayDate.getDate() &&
          d.getMonth() === dayDate.getMonth()
        );
      }).length;
      if (completedOnDay > 0) hasActivity = true;
      return { label: dayLabel, count: completedOnDay };
    });

    const maxDailyTasks = Math.max(...dailyData.map((d) => d.count), 1);

    return {
      window: targetWeek,
      completedCount: completedThisWeek.length,
      pendingCount: pendingThisWeek.length,
      completionRate:
        tasksThisWeek.length > 0
          ? Math.round((completedThisWeek.length / tasksThisWeek.length) * 100)
          : 0,
      trend,
      dailyData,
      maxDailyTasks,
      hasActivity: hasActivity || pendingThisWeek.length > 0,
    };
  }, [tasks, weekOffset]);

  // Determine the content area without hiding the top navigation bar
  let contentArea;

  if (loading) {
    contentArea = (
      <div className="flex h-64 items-center justify-center text-slate-500 font-medium animate-pulse">
        Loading analysis...
      </div>
    );
  } else if (error) {
    contentArea = (
      <div className="flex flex-col h-64 items-center justify-center text-red-500 font-medium gap-4">
        <p>{error}</p>
        <button
          onClick={fetchTasks}
          className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  } else if (!stats) {
    contentArea = (
      <div className="flex h-64 items-center justify-center text-slate-500">
        Add some tasks to see your analytics.
      </div>
    );
  } else {
    contentArea = (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-4 flex flex-col gap-6">
          <StatCard
            title="Tasks Completed"
            icon={CheckCircle}
            mainValue={stats.completedCount}
            trend={stats.trend}
          />
          <StatCard
            title="Pending Workload"
            icon={Clock}
            mainValue={stats.pendingCount}
            subValue="Tasks awaiting completion"
          />
        </div>

        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm min-h-[300px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-lg flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-indigo-500" /> Activity
                Overview
              </h2>
              {stats.hasActivity && (
                <span className="text-sm font-medium text-slate-500 bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                  {stats.completionRate}% Completion Rate
                </span>
              )}
            </div>

            {!stats.hasActivity ? (
              <div className="flex flex-col items-center justify-center h-48 opacity-60">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl mb-4 flex items-center justify-center">
                  <BarChart2 className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-500 font-semibold mb-1">
                  No activity this week
                </h3>
              </div>
            ) : (
              <div className="h-56 flex items-end justify-between gap-3 px-2">
                {stats.dailyData.map((day, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center flex-1 group h-full"
                  >
                    <div className="relative w-full flex justify-center h-full items-end">
                      <div
                        className="w-full max-w-[48px] bg-indigo-50 border border-indigo-100 rounded-t-xl group-hover:bg-indigo-500 transition-all duration-300"
                        style={{
                          height: `${(day.count / stats.maxDailyTasks) * 100}%`,
                          minHeight: day.count > 0 ? "12%" : "0%",
                        }}
                      ></div>
                    </div>
                    <span className="text-xs text-slate-400 mt-4 font-bold uppercase tracking-widest">
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Fallback to calculate current window if stats haven't loaded yet
  const displayWindow = stats?.window || getWeekWindow(weekOffset);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors font-medium px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>

        <div className="flex items-center bg-white rounded-full shadow-sm border border-slate-200 p-1">
          <button
            aria-label="Previous week"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>

          <span className="px-4 font-medium text-sm text-slate-700 min-w-[150px] text-center">
            {weekOffset === 0
              ? "Current Week"
              : `${formatDate(displayWindow.start)} - ${formatDate(displayWindow.end)}`}
          </span>

          <button
            aria-label="Next week"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">{contentArea}</div>
    </div>
  );
};

export default Report;
