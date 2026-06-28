import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  LayoutDashboard,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Coffee,
  Sun,
  CalendarDays,
  History as HistoryIcon
} from "lucide-react";
import api from "../utils/api";
import TaskCard from "../components/TaskCard";

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("today");
  const [isMissedOpen, setIsMissedOpen] = useState(false);

  const queryClient = useQueryClient();

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const {
    data,
    isLoading: loading,
    isError,
    error,
  } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: async () => {
      const [userResponse, tasksResponse] = await Promise.all([
        api.get("/user/me"),
        api.get("/tasks/"),
      ]);
      return {
        userInfo: userResponse.data,
        tasks: tasksResponse.data,
      };
    },
    staleTime: 5 * 60 * 1000,
    retry: (failureCount, error) => error.response?.status !== 401,
  });

  useEffect(() => {
    if (isError && error.response?.status === 401) {
      handleLogout();
    }
  }, [isError, error]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
  }, [navigate]);

  const userInfo = data?.userInfo || null;
  const tasks = data?.tasks || [];

  const refreshTasks = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
  };

  // --- IST / TIMEZONE FIX HELPER ---
  const getSafeDate = (dateString) => {
    if (!dateString) return new Date();
    return new Date(dateString.endsWith("Z") ? dateString : `${dateString}Z`);
  };

  // --- Filtering Logic ---
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
  );

  // 1. Missed (Past due date & not completed)
  const missedTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate < startOfToday && task.status === "pending";
  });

  // 2. Today
  const todayTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return (
      dueDate >= startOfToday &&
      dueDate <= endOfToday &&
      task.status === "pending"
    );
  });

  // 3. Upcoming
  const upcomingTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate > endOfToday && task.status === "pending";
  });

  // 4. History (Completed)
  const completedTasks = tasks.filter((task) => {
    return task.status === "completed";
  });

  const getDisplayedTasks = () => {
    if (activeTab === "upcoming") return upcomingTasks;
    if (activeTab === "history") return completedTasks;
    return todayTasks;
  };

  const displayedTasks = getDisplayedTasks();

  // Updated tabs array with Icons included
  const tabs = [
    { id: "today", label: "Today", count: todayTasks.length, icon: Sun },
    { id: "upcoming", label: "Upcoming", count: upcomingTasks.length, icon: CalendarDays },
    { id: "history", label: "History", count: completedTasks.length, icon: HistoryIcon },
  ];

  useEffect(() => {
    if (missedTasks.length === 0) {
      setIsMissedOpen(false);
    }
  }, [missedTasks.length]);

  const initial = userInfo?.username?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="text-blue-600" size={22} />
            <h1 className="text-lg font-black text-gray-900 tracking-tight">
              Remind<span className="text-blue-600">Me</span>
            </h1>
          </div>

          <Link
            to="/profile"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm hover:bg-blue-200 transition-colors shadow-sm"
            aria-label="Profile"
          >
            {initial}
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4">
        <div className="flex items-end justify-between mt-6 mb-6">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </p>
            <h2 className="text-2xl font-black text-gray-900 mt-0.5">
              Hello, {userInfo?.username?.split(" ")[0] || "..."} 👋
            </h2>
          </div>

          <Link
            to="/create-task"
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all"
          >
            <Plus size={18} strokeWidth={3} />
            <span className="hidden sm:inline">New Reminder</span>
          </Link>
        </div>

        {missedTasks.length > 0 && (
          <div className="mb-6 bg-red-50/70 border border-red-200 rounded-2xl transition-all overflow-hidden">
            <button
              onClick={() => setIsMissedOpen(!isMissedOpen)}
              className="w-full flex items-center justify-between p-4 text-red-700 hover:bg-red-100/50 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600 shrink-0" />
                <h3 className="text-xs font-black uppercase tracking-wider">
                  Missed Reminders ({missedTasks.length})
                </h3>
              </div>
              {isMissedOpen ? (
                <ChevronUp size={20} className="text-red-500" />
              ) : (
                <ChevronDown size={20} className="text-red-500" />
              )}
            </button>

            {isMissedOpen && (
              <div className="px-4 pb-4 grid gap-3.5 max-h-[50vh] overflow-y-auto border-t border-red-100 pt-3">
                {missedTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    refreshTasks={refreshTasks}
                    isPrevious={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Updated Tabs Section with Icons */}
        <div className="flex space-x-1.5 bg-gray-200/60 p-1.5 rounded-xl mb-6 border border-gray-200">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex justify-center items-center gap-1.5 ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                <Icon size={16} className={isActive ? "text-blue-600" : "text-gray-400"} />
                {tab.label}
                <span
                  className={`px-1.5 py-0.5 rounded-full text-xs ${
                    isActive ? "bg-gray-100 text-gray-800" : "bg-gray-200/80 text-gray-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Added min-height to loader container so layout doesn't shift */}
        {loading ? (
          <div className="flex justify-center items-center min-h-[300px] text-blue-600">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedTasks.length === 0 ? (
              // Updated Empty State UI
              <div className="text-center py-16 bg-white rounded-2xl border-2 border-gray-200 border-dashed flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-4">
                  <Coffee size={32} strokeWidth={2.5} />
                </div>
                <p className="text-gray-900 font-bold text-lg">
                  No reminders found here.
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  You're all caught up! Time for a break.
                </p>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  refreshTasks={refreshTasks}
                  isPrevious={activeTab === "history"}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}