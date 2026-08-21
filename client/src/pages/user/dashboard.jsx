import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  Coffee,
  Sun,
  CalendarDays,
  CheckCircle2,
} from "lucide-react";
import api from "../../utils/api";
import TaskCard from "../../components/TaskCard";
import Header from "../../components/Header";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("today");
  const [isMissedOpen, setIsMissedOpen] = useState(false);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("token");
    navigate("/");
  }, [navigate]);

  // Auth Guard
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
  }, [navigate]);

  // Data Fetching
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: async () => {
      const [userResponse, tasksResponse] = await Promise.all([
        api.get("/user/me"),
        api.get("/tasks/"),
      ]);
      return {
        userInfo: userResponse.data,
        tasks: tasksResponse.data || [],
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: (_, err) => err?.response?.status !== 401,
  });

  useEffect(() => {
    if (isError && error?.response?.status === 401) {
      handleLogout();
    }
  }, [isError, error, handleLogout]);

  const userInfo = data?.userInfo || null;
  const tasks = data?.tasks || [];

  const refreshTasks = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
  };

  // --- Dynamic Greeting (Stable across renders) ---
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "Late night grind";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // --- Task Categorization Engine ---
  const { missedTasks, todayTasks, upcomingTasks, completedTasks } =
    useMemo(() => {
      const now = new Date();
      const startOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
      ).getTime();
      const endOfToday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        23,
        59,
        59,
        999,
      ).getTime();

      const missed = [];
      const today = [];
      const upcoming = [];
      const completed = [];

      tasks.forEach((task) => {
        if (task.status === "completed") {
          completed.push(task);
          return;
        }

        if (!task.due_date) {
          upcoming.push(task);
          return;
        }

        // Safe Local Date Parsing
        const dateVal = new Date(task.due_date).getTime();

        if (isNaN(dateVal)) {
          upcoming.push(task);
        } else if (dateVal < startOfToday) {
          missed.push(task);
        } else if (dateVal >= startOfToday && dateVal <= endOfToday) {
          today.push(task);
        } else {
          upcoming.push(task);
        }
      });

      return {
        missedTasks: missed,
        todayTasks: today,
        upcomingTasks: upcoming,
        completedTasks: completed,
      };
    }, [tasks]);

  useEffect(() => {
    if (missedTasks.length === 0) {
      setIsMissedOpen(false);
    }
  }, [missedTasks.length]);

  const displayedTasks = useMemo(() => {
    if (activeTab === "upcoming") return upcomingTasks;
    if (activeTab === "completed") return completedTasks;
    return todayTasks;
  }, [activeTab, upcomingTasks, completedTasks, todayTasks]);

  const tabs = [
    { id: "today", label: "Today", count: todayTasks.length, icon: Sun },
    {
      id: "upcoming",
      label: "Upcoming",
      count: upcomingTasks.length,
      icon: CalendarDays,
    },
    {
      id: "completed",
      label: "Done",
      count: completedTasks.length,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24 text-slate-900 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif]">
      <Header />

      <main className="max-w-2xl mx-auto px-5 sm:px-6">
        <div className="pt-10 pb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
            {greeting},{" "}
            <span className="text-slate-500 font-normal">
              {userInfo?.username ? userInfo.username.split(" ")[0] : "there"}
            </span>
          </h1>
        </div>

        {/* Overdue Banner */}
        {missedTasks.length > 0 && (
          <div className="mb-6 bg-white/90 backdrop-blur-md rounded-2xl border border-rose-100 shadow-sm overflow-hidden transition-all duration-200">
            <button
              onClick={() => setIsMissedOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 px-4 bg-rose-50/50 hover:bg-rose-50/80 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
                  <AlertCircle size={15} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-semibold text-rose-900 block leading-tight">
                    Overdue Tasks
                  </span>
                  <span className="text-[11px] text-rose-600 font-normal">
                    {missedTasks.length}{" "}
                    {missedTasks.length === 1 ? "item needs" : "items need"}{" "}
                    attention
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <ChevronDown
                  size={14}
                  strokeWidth={2.5}
                  className={`transition-transform duration-200 ${isMissedOpen ? "rotate-180" : "rotate-0"}`}
                />
              </div>
            </button>

            {isMissedOpen && (
              <div className="p-3 pt-1 grid gap-2 max-h-[40vh] overflow-y-auto border-t border-rose-100/60">
                {missedTasks.map((task) => (
                  <TaskCard
                    key={task.id || task._id}
                    task={task}
                    refreshTasks={refreshTasks}
                    isPrevious={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="p-1 bg-[#E5E5EA]/80 backdrop-blur-md rounded-xl mb-6 grid grid-cols-3 gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full py-1.5 px-1 sm:px-2 text-xs sm:text-sm font-medium rounded-lg transition-all duration-150 flex items-center justify-center gap-1 select-none overflow-hidden ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon
                  size={14}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={
                    isActive
                      ? "text-blue-600 shrink-0"
                      : "text-slate-400 shrink-0"
                  }
                />
                <span className="truncate">{tab.label}</span>
                <span
                  className={`px-1 py-0.5 text-[10px] rounded-full font-medium shrink-0 ${
                    isActive
                      ? "bg-slate-100 text-slate-700"
                      : "bg-slate-300/40 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Task List */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 text-slate-400 space-y-3">
            <Loader2 className="animate-spin text-slate-500" size={22} />
            <p className="text-xs font-medium text-slate-400">
              Loading tasks...
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200/60 flex flex-col items-center justify-center">
                <div className="w-10 h-10 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                  <Coffee size={20} strokeWidth={1.8} />
                </div>
                <h3 className="text-slate-900 font-medium text-sm mb-0.5">
                  All Clear
                </h3>
                <p className="text-xs text-slate-400 font-normal max-w-xs">
                  {activeTab === "completed"
                    ? "Completed tasks will show up here."
                    : activeTab === "upcoming"
                      ? "No upcoming tasks found."
                      : "You're all caught up for today."}
                </p>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <TaskCard
                  key={task.id || task._id}
                  task={task}
                  refreshTasks={refreshTasks}
                  isPrevious={activeTab === "completed"}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
