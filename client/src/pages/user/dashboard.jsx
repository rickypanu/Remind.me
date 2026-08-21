import React, { useState, useEffect } from "react";
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
    if (!dateString) return null;
    return new Date(dateString.endsWith("Z") ? dateString : `${dateString}Z`);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();

    const greetings = {
      lateNight: ["Working late", "Quiet hours", "Night owl focus", "Late night grind"],
      morning: ["Good morning", "Rise and shine", "Fresh start", "Ready for today"],
      afternoon: ["Good afternoon", "Keep moving", "Focus mode", "Midday momentum"],
      evening: ["Good evening", "Winding down", "Day's wrap", "Time to recharge"],
    };
    let timeCategory;
    if (hour < 6) timeCategory = "lateNight";
    else if (hour < 12) timeCategory = "morning";
    else if (hour < 18) timeCategory = "afternoon";
    else timeCategory = "evening";

    const options = greetings[timeCategory];
    return options[Math.floor(Math.random() * options.length)];
  };

  // --- Filtering Logic ---
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59
  );

  const missedTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate && dueDate < startOfToday && task.status === "pending";
  });

  const todayTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return (
      dueDate &&
      dueDate >= startOfToday &&
      dueDate <= endOfToday &&
      task.status === "pending"
    );
  });

  const upcomingTasks = tasks.filter((task) => {
    if (task.status !== "pending") return false;
    const dueDate = getSafeDate(task.due_date);
    if (!dueDate) return true;
    return dueDate > endOfToday;
  });

  const completedTasks = tasks.filter((task) => task.status === "completed");

  const getDisplayedTasks = () => {
    if (activeTab === "upcoming") return upcomingTasks;
    if (activeTab === "completed") return completedTasks;
    return todayTasks;
  };

  const displayedTasks = getDisplayedTasks();

  const tabs = [
    { id: "today", label: "Today", count: todayTasks.length, icon: Sun },
    { id: "upcoming", label: "Upcoming", count: upcomingTasks.length, icon: CalendarDays },
    { id: "completed", label: "Done", count: completedTasks.length, icon: CheckCircle2 },
  ];

  useEffect(() => {
    if (missedTasks.length === 0) {
      setIsMissedOpen(false);
    }
  }, [missedTasks.length]);

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-24 text-slate-900 antialiased selection:bg-blue-500/20 selection:text-blue-600 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      <Header />

      <main className="max-w-2xl mx-auto px-5 sm:px-6">
        {/* Apple-style Hero Header */}
        <div className="pt-12 pb-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          
          <h1 className="text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight leading-tight">
            {getGreeting()}, <span className="text-slate-500 font-normal">{userInfo?.username?.split(" ")[0]}</span>
          </h1>
        </div>

        {/* Missed Tasks / Notification Banner (iOS Card Style) */}
        {missedTasks.length > 0 && (
          <div className="mb-6 bg-white/80 backdrop-blur-md rounded-2xl border border-rose-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden transition-all duration-300">
            <button
              onClick={() => setIsMissedOpen(!isMissedOpen)}
              className="w-full flex items-center justify-between p-3.5 px-4 bg-rose-50/40 hover:bg-rose-50/70 transition-colors focus:outline-none group active:scale-[0.99]"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-sm">
                  <AlertCircle size={15} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-semibold text-rose-900 block leading-tight">
                    Overdue Tasks
                  </span>
                  <span className="text-[11px] text-rose-600/90 font-normal">
                    {missedTasks.length} {missedTasks.length === 1 ? "item needs" : "items need"} attention
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 group-hover:bg-slate-200 transition-colors">
                <ChevronDown
                  size={14}
                  strokeWidth={2.5}
                  className={`transition-transform duration-300 ease-out ${
                    isMissedOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </div>
            </button>

            {/* Expandable Container */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isMissedOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-3 pt-0 grid gap-2 max-h-[40vh] overflow-y-auto">
                  {missedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      refreshTasks={refreshTasks}
                      isPrevious={false}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Native Segmented Control */}
        <div className="p-1 bg-[#E5E5EA]/70 backdrop-blur-md rounded-xl mb-6 shadow-inner flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-1.5 px-3 text-xs sm:text-sm font-medium rounded-lg transition-all duration-200 ease-out flex items-center justify-center gap-2 select-none active:scale-[0.98] ${
                  isActive
                    ? "bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] font-semibold"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Icon
                  size={15}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  className={isActive ? "text-blue-600" : "text-slate-400"}
                />
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 text-[10px] rounded-full font-medium transition-colors ${
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

        {/* Task Section */}
        {loading ? (
          <div className="flex flex-col justify-center items-center py-24 text-slate-400 space-y-3">
            <Loader2 className="animate-spin text-slate-500" size={24} strokeWidth={2} />
            <p className="text-xs font-medium text-slate-400 tracking-wide">
              Syncing...
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white/60 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-3">
                  <Coffee size={22} strokeWidth={1.8} />
                </div>
                <h3 className="text-slate-900 font-medium text-sm mb-0.5">
                  All Clear
                </h3>
                <p className="text-xs text-slate-400 font-normal max-w-xs">
                  {activeTab === "completed"
                    ? "Completed tasks will show up here."
                    : activeTab === "upcoming"
                    ? "No scheduled tasks on your radar."
                    : "You're all caught up for today."}
                </p>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
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