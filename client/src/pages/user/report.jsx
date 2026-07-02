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
  Loader2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

// --- Utility Functions ---

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
      bgColor: "bg-emerald-50",
    };
  if (diff < 0)
    return {
      type: "down",
      text: `${Math.abs(diff)} fewer than last week`,
      icon: TrendingDown,
      color: "text-rose-500",
      bgColor: "bg-rose-50",
    };
  return {
    type: "neutral",
    text: "Same as last week",
    icon: Minus,
    color: "text-slate-400",
    bgColor: "bg-slate-100",
  };
};

// --- Reusable Sub-Components ---

const StatCard = ({ title, icon: Icon, mainValue, subValue, trend }) => (
  <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col justify-between h-48 md:h-auto md:flex-1 transition-all duration-300 hover:border-slate-300">
    <div className="flex items-center gap-2.5 text-slate-500">
      <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
        <Icon className="w-5 h-5 text-slate-600" strokeWidth={2.5} />
      </div>
      <span className="font-bold text-sm tracking-wide">{title}</span>
    </div>
    <div className="mt-4 md:mt-6">
      <div className="text-5xl md:text-6xl font-black tracking-tight text-slate-900">
        {mainValue}
      </div>
      {trend ? (
        <div className="flex items-center gap-1.5 mt-3">
          <div className={`p-1 rounded-md ${trend.bgColor}`}>
            <trend.icon className={`w-3.5 h-3.5 ${trend.color}`} strokeWidth={3} />
          </div>
          <span className={`text-xs font-bold ${trend.color}`}>
            {trend.text}
          </span>
        </div>
      ) : (
        <div className="text-xs text-slate-400 mt-3 font-semibold uppercase tracking-wider">
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// --- Main Component ---

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
        if (!task.due_date) return false;
        const taskDate = new Date(task.due_date);
        return taskDate >= start && taskDate <= end;
      });

    const tasksThisWeek = filterTasksForWindow(targetWeek.start, targetWeek.end);
    const tasksLastWeek = filterTasksForWindow(previousWeek.start, previousWeek.end);

    const completedThisWeek = tasksThisWeek.filter((t) => t.status === "completed");
    const pendingThisWeek = tasksThisWeek.filter((t) => t.status === "pending");

    const completedLastWeekCount = tasksLastWeek.filter((t) => t.status === "completed").length;
    const trend = getTrend(completedThisWeek.length, completedLastWeekCount);

    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let hasActivity = false;

    const dailyData = days.map((dayLabel, index) => {
      const dayDate = new Date(targetWeek.start);
      dayDate.setDate(targetWeek.start.getDate() + index);
      const completedOnDay = completedThisWeek.filter((t) => {
        const d = new Date(t.due_date);
        return d.getDate() === dayDate.getDate() && d.getMonth() === dayDate.getMonth();
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

  // --- Content Rendering ---

  let contentArea;

  if (loading) {
    contentArea = (
      <div className="flex flex-col h-64 items-center justify-center text-indigo-600 gap-4">
        <Loader2 className="w-8 h-8 animate-spin" />
        <span className="text-sm font-medium text-slate-500 animate-pulse">
          Analyzing your productivity...
        </span>
      </div>
    );
  } else if (error) {
    contentArea = (
      <div className="flex flex-col h-64 items-center justify-center text-rose-500 font-medium gap-4 bg-white rounded-[2rem] border border-rose-100 shadow-sm">
        <p>{error}</p>
        <button
          onClick={fetchTasks}
          className="px-6 py-2.5 bg-rose-50 text-rose-600 font-bold rounded-xl hover:bg-rose-100 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  } else if (!stats) {
    contentArea = (
      <div className="flex flex-col h-64 items-center justify-center text-slate-500 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
        <BarChart2 className="w-12 h-12 text-slate-200 mb-4" />
        <p className="font-medium">Complete some tasks to see your analytics.</p>
      </div>
    );
  } else {
    contentArea = (
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Left Column: Stat Cards */}
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

        {/* Right Column: Chart Area */}
        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="bg-white rounded-[2rem] p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col h-full min-h-[340px]">
            <div className="flex items-center justify-between mb-8">
              <h2 className="font-bold text-xl text-slate-900 flex items-center gap-2">
                <BarChart2 className="w-6 h-6 text-indigo-500" /> 
                Activity Overview
              </h2>
              {stats.hasActivity && (
                <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100">
                  {stats.completionRate}% Completion Rate
                </span>
              )}
            </div>

            {!stats.hasActivity ? (
              <div className="flex-1 flex flex-col items-center justify-center opacity-60">
                <div className="w-16 h-16 bg-slate-50 border border-slate-100 rounded-2xl mb-4 flex items-center justify-center">
                  <BarChart2 className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-slate-500 font-semibold mb-1">
                  No activity this week
                </h3>
              </div>
            ) : (
              <div className="flex-1 flex items-end justify-between gap-2 sm:gap-4 px-2 pt-10">
                {stats.dailyData.map((day, i) => (
                  <div
                    key={i}
                    className="flex flex-col items-center flex-1 group h-full relative"
                  >
                    {/* Hover Tooltip */}
                    <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-xs font-bold py-1.5 px-2.5 rounded-lg pointer-events-none whitespace-nowrap shadow-lg z-10">
                      {day.count} {day.count === 1 ? 'task' : 'tasks'}
                      {/* Tooltip Arrow */}
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>

                    {/* Bar */}
                    <div className="relative w-full flex justify-center h-full items-end">
                      <div
                        className="w-full max-w-[48px] bg-slate-100 rounded-t-xl group-hover:bg-indigo-500 transition-all duration-300 relative overflow-hidden"
                        style={{
                          height: `${(day.count / stats.maxDailyTasks) * 100}%`,
                          minHeight: day.count > 0 ? "12%" : "4px",
                        }}
                      >
                        {/* Subtle gradient overlay for active bars */}
                        {day.count > 0 && (
                          <div className="absolute inset-0 bg-gradient-to-t from-indigo-100/50 to-transparent group-hover:from-indigo-600 group-hover:to-indigo-400 transition-colors"></div>
                        )}
                      </div>
                    </div>
                    
                    {/* Day Label */}
                    <span className="text-[10px] sm:text-xs text-slate-400 mt-4 font-bold uppercase tracking-widest group-hover:text-slate-700 transition-colors">
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

  const displayWindow = stats?.window || getWeekWindow(weekOffset);

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-8 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Top Navigation */}
      <div className="max-w-6xl mx-auto mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <div className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm hover:bg-slate-50">
             <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Dashboard
        </button>

        {/* Date / Week Navigator */}
        <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1 w-full md:w-auto">
          <button
            aria-label="Previous week"
            onClick={() => setWeekOffset((prev) => prev - 1)}
            className="p-2 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="px-4 font-bold text-sm text-slate-700 min-w-[180px] text-center">
            {weekOffset === 0
              ? "Current Week"
              : `${formatDate(displayWindow.start)} - ${formatDate(displayWindow.end)}`}
          </span>

          <button
            aria-label="Next week"
            onClick={() => setWeekOffset((prev) => prev + 1)}
            disabled={weekOffset === 0} // Optional: Prevent navigating into the future
            className={`p-2 rounded-lg transition-colors ${
              weekOffset === 0 
                ? "text-slate-300 cursor-not-allowed" 
                : "hover:bg-slate-50 text-slate-500 hover:text-slate-900"
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">{contentArea}</div>
    </div>
  );
};

export default Report;