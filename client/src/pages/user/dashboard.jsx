import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Coffee,
  Sun,
  CalendarDays,
  History as HistoryIcon,
} from "lucide-react";
import api from "../../utils/api";
import TaskCard from "../../components/TaskCard";
import Header from "../../components/Header";

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

  // --- Time & Date Helpers ---
  const getSafeDate = (dateString) => {
    if (!dateString) return new Date();
    return new Date(dateString.endsWith("Z") ? dateString : `${dateString}Z`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  // --- Filtering Logic ---
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const missedTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate < startOfToday && task.status === "pending";
  });

  const todayTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate >= startOfToday && dueDate <= endOfToday && task.status === "pending";
  });

  const upcomingTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate > endOfToday && task.status === "pending";
  });

  const completedTasks = tasks.filter((task) => task.status === "completed");

  const getDisplayedTasks = () => {
    if (activeTab === "upcoming") return upcomingTasks;
    if (activeTab === "history") return completedTasks;
    return todayTasks;
  };

  const displayedTasks = getDisplayedTasks();

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

  return (
    <div className="min-h-screen bg-gray-50/50 pb-20 font-sans">
      <Header />

      <main className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Welcome Section */}
        <div className="mt-8 mb-10">
          <div className="inline-block px-3 py-1 mb-3 bg-blue-100/50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest border border-blue-200/50">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 tracking-tight">
            {getGreeting()},{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-500">
              {userInfo?.username?.split(" ")[0] || "..."}
            </span>{" "}
            👋
          </h2>
        </div>

        {/* Missed Tasks Alert */}
        {missedTasks.length > 0 && (
          <div className="mb-8 bg-white border border-red-200 rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setIsMissedOpen(!isMissedOpen)}
              className="w-full flex items-center justify-between p-4 bg-red-50/50 hover:bg-red-50 transition-colors focus:outline-none group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg group-hover:scale-105 transition-transform">
                  <AlertCircle size={20} className="text-red-600 shrink-0" />
                </div>
                <h3 className="text-sm font-bold text-red-900">
                  Missed Reminders <span className="opacity-60 font-medium">({missedTasks.length})</span>
                </h3>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm border border-red-100">
                {isMissedOpen ? (
                  <ChevronUp size={18} className="text-red-500" />
                ) : (
                  <ChevronDown size={18} className="text-red-500" />
                )}
              </div>
            </button>

            {isMissedOpen && (
              <div className="px-4 pb-4 pt-2 grid gap-3 max-h-[50vh] overflow-y-auto bg-red-50/20">
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

        {/* Segmented Control Tabs */}
        <div className="flex p-1 bg-gray-200/80 rounded-2xl mb-8 border border-gray-200/50 shadow-inner">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2.5 px-2 text-sm font-bold rounded-xl transition-all duration-200 flex justify-center items-center gap-2 ${
                  isActive
                    ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
                }`}
              >
                <Icon
                  size={18}
                  className={isActive ? "text-blue-600" : "text-gray-400"}
                />
                <span className="hidden sm:inline">{tab.label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "bg-gray-300/50 text-gray-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Task List / Loading / Empty State */}
        {loading ? (
          <div className="flex flex-col justify-center items-center min-h-[300px] text-blue-600 space-y-4">
            <Loader2 className="animate-spin" size={36} />
            <p className="text-sm font-semibold text-gray-500 animate-pulse">Loading reminders...</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm flex flex-col items-center justify-center transition-all">
                <div className="w-20 h-20 bg-gradient-to-br from-green-50 to-emerald-100 text-green-600 rounded-2xl flex items-center justify-center mb-5 shadow-inner rotate-3">
                  <Coffee size={36} strokeWidth={2.5} className="-rotate-3" />
                </div>
                <h3 className="text-gray-900 font-black text-xl mb-2">
                  No reminders found here
                </h3>
                <p className="text-base text-gray-500 font-medium">
                  You're all caught up! Time for a well-deserved break.
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