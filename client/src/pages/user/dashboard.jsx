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
  lateNight: ["Still at it?", "Night owl hours.", "Main character energy late night.", "Code never sleeps."],
  morning: ["Morning, legend.", "New day, new dubs.", "Rise and thrive.", "Manifesting a great day."],
  afternoon: ["What's the move?", "Keep that energy.", "Stay locked in.", "High key killing it today."],
  evening: ["Time to disconnect.", "Big chill energy.", "Day's done. Reset.", "Evenin', time to recharge."]
};
  let timeCategory;
  if (hour < 6) timeCategory = 'lateNight';
  else if (hour < 12) timeCategory = 'morning';
  else if (hour < 18) timeCategory = 'afternoon';
  else timeCategory = 'evening';

  // Randomly select one from the array for variety
  const options = greetings[timeCategory];
  return options[Math.floor(Math.random() * options.length)];
};


  // --- Filtering Logic ---
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  const missedTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate && dueDate < startOfToday && task.status === "pending";
  });

  const todayTasks = tasks.filter((task) => {
    const dueDate = getSafeDate(task.due_date);
    return dueDate && dueDate >= startOfToday && dueDate <= endOfToday && task.status === "pending";
  });

  // Upcoming catches EVERYTHING in the future + tasks without dates
  const upcomingTasks = tasks.filter((task) => {
    if (task.status !== "pending") return false;
    const dueDate = getSafeDate(task.due_date);
    if (!dueDate) return true; // Undated tasks go here
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
    { id: "completed", label: "Completed", count: completedTasks.length, icon: CheckCircle2 },
  ];

  useEffect(() => {
    if (missedTasks.length === 0) {
      setIsMissedOpen(false);
    }
  }, [missedTasks.length]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Header />

      <main className="max-w-3xl mx-auto px-4 sm:px-6">
        {/* Welcome Section */}
        <div className="mt-10 mb-8">
          <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </span>
         
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
  {getGreeting()}, <span className="text-indigo-600">{userInfo?.username?.split(" ")[0]}</span> 👋
</h2>
           
        </div>

        {/* Missed Tasks Alert */}
        {missedTasks.length > 0 && (
          <div className="mb-8 bg-white border border-rose-100 rounded-2xl shadow-sm overflow-hidden transition-all duration-300">
            <button
              onClick={() => setIsMissedOpen(!isMissedOpen)}
              className="w-full flex items-center justify-between p-4 bg-rose-50/50 hover:bg-rose-50 transition-colors focus:outline-none group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-100/80 rounded-xl text-rose-600 group-hover:scale-105 transition-transform duration-300">
                  <AlertCircle size={20} strokeWidth={2.5} />
                </div>
                <h3 className="text-sm font-bold text-rose-900">
                  Missed Reminders{" "}
                  <span className="opacity-60 font-semibold ml-1">
                    ({missedTasks.length})
                  </span>
                </h3>
              </div>
              <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white shadow-sm border border-rose-100/50 text-rose-500">
                <ChevronDown
                  size={18}
                  className={`transition-transform duration-300 ${
                    isMissedOpen ? "rotate-180" : "rotate-0"
                  }`}
                />
              </div>
            </button>

            {/* Expandable Content Area */}
            <div
              className={`grid transition-all duration-300 ease-in-out bg-rose-50/30 ${
                isMissedOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-4 pb-4 pt-1 grid gap-3 max-h-[40vh] overflow-y-auto">
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

        {/* Segmented Control Tabs (Back to 3 options) */}
        <div className="flex p-1 bg-slate-200/60 rounded-2xl mb-8 shadow-inner overflow-x-auto hide-scrollbar">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-1.5 sm:px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-300 flex justify-center items-center gap-1.5 sm:gap-2.5 whitespace-nowrap min-w-[75px] sm:min-w-0 ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm ring-1 ring-black/5"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                <Icon
                  size={16} // Slightly smaller icon on mobile
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-colors shrink-0 sm:w-[18px] sm:h-[18px] ${
                    isActive ? "text-indigo-600" : "text-slate-400"
                  }`}
                />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] sm:text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-indigo-50 text-indigo-700"
                      : "bg-slate-200/80 text-slate-500"
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
          <div className="flex flex-col justify-center items-center min-h-[40vh] text-indigo-600 space-y-4">
            <Loader2 className="animate-spin" size={32} />
            <p className="text-sm font-medium text-slate-500 animate-pulse">
              Syncing reminders...
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-4 ring-1 ring-slate-100">
                  <Coffee size={28} strokeWidth={2} />
                </div>
                <h3 className="text-slate-800 font-bold text-lg mb-1">
                  Nothing to see here
                </h3>
                <p className="text-sm text-slate-500 font-medium">
                  {activeTab === "completed"
                    ? "You haven't completed any tasks yet."
                    : activeTab === "upcoming" 
                    ? "No future tasks scheduled."
                    : "You're all caught up! Enjoy your day."}
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