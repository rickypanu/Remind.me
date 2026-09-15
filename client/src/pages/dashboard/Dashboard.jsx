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
  Sparkles,
  Check,
  ArrowUp,
  Mic,
  MicOff,
  ArrowUpDown
} from "lucide-react";
import api from "../../utils/api";
import TaskCard from "../tasks/TaskCard";
import Header from "../components/Header";

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("today");
  const [isMissedOpen, setIsMissedOpen] = useState(false);
  const [isDoneOpen, setIsDoneOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  
  // Magic Add States
  const [magicText, setMagicText] = useState("");
  const [isMagicAdding, setIsMagicAdding] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // --- Sort State for Completed Tasks ---
  const [completedSort, setCompletedSort] = useState("date-desc");

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

  const refreshTasks = (message) => {
    queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
    
    // Check if message is a string (prevents issues if an event object is accidentally passed)
    const toastText = typeof message === "string" ? message : "Task marked complete!";
    
    setToastMessage(toastText);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // --- Voice Input Handler ---
  const handleVoiceInput = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setToastMessage("❌ Voice input is not supported in this browser.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN"; // Optimized for Hindi/Hinglish
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMagicText(transcript);
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
      setToastMessage("❌ Mic access error or timeout.");
      setTimeout(() => setToastMessage(null), 3000);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  // --- Magic Add Handler ---
  const handleMagicAdd = async (e) => {
    e.preventDefault();
    if (!magicText.trim()) return;

    setIsMagicAdding(true);
    try {
      await api.post("/tasks/magic-add", { text: magicText });
      setMagicText(""); // Clear input on success
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      
      setToastMessage("✨ Task magically added!");
      setTimeout(() => setToastMessage(null), 3500);
    } catch (error) {
      console.error("Magic Add failed:", error);
      setToastMessage("Failed to parse task. Try again.");
      setTimeout(() => setToastMessage(null), 3500);
    } finally {
      setIsMagicAdding(false);
    }
  };

  // --- Dynamic Greeting ---
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

  // --- Sorting Logic for Completed Tasks ---
  const sortedCompletedTasks = useMemo(() => {
    return [...completedTasks].sort((a, b) => {
      // Helper to safely get dates (fallback to 0 if no date exists)
      const dateA = new Date(a.due_date || 0).getTime();
      const dateB = new Date(b.due_date || 0).getTime();
      
      // Helper to safely get titles (lowercase for accurate A-Z sorting)
      const titleA = (a.title || "").toLowerCase();
      const titleB = (b.title || "").toLowerCase();

      switch (completedSort) {
        case "title-asc":
          return titleA.localeCompare(titleB);
        case "title-desc":
          return titleB.localeCompare(titleA);
        case "date-asc":
          return dateA - dateB;
        case "date-desc":
        default:
          return dateB - dateA;
      }
    });
  }, [completedTasks, completedSort]);

  useEffect(() => {
    if (missedTasks.length === 0) {
      setIsMissedOpen(false);
    }
  }, [missedTasks.length]);

  const displayedTasks = useMemo(() => {
    if (activeTab === "upcoming") return upcomingTasks;
    return todayTasks;
  }, [activeTab, upcomingTasks, todayTasks]);

  const tabs = [
    { id: "today", label: "Today", count: todayTasks.length, icon: Sun },
    {
      id: "upcoming",
      label: "Upcoming",
      count: upcomingTasks.length,
      icon: CalendarDays,
    },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFC] pb-28 text-slate-900 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif] relative overflow-x-hidden">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-sm font-semibold animate-in fade-in slide-in-from-bottom-5 duration-300 border border-slate-800">
          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ${toastMessage.includes("❌") ? "bg-red-500" : "bg-emerald-500"}`}>
            <Check size={12} strokeWidth={3} />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      <Header />

      <main className="max-w-xl mx-auto px-5 sm:px-6">
        
        {/* Header Section */}
        <div className="pt-10 pb-6 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              {greeting},{" "}
              <span className="text-blue-600 font-semibold">
                {userInfo?.username ? userInfo.username.split(" ")[0] : "there"}
              </span>
            </h1>
          </div>
        </div>

        {/* --- Magic Add Input with Voice --- */}
        <form onSubmit={handleMagicAdd} className="mb-6 relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Sparkles className="text-blue-400 group-focus-within:text-blue-600 transition-colors duration-200" size={20} strokeWidth={2.5} />
          </div>
          
          <input
            type="text"
            value={magicText}
            onChange={(e) => setMagicText(e.target.value)}
            disabled={isMagicAdding || isListening}
            placeholder={isListening ? "Listening... " : "Type or speak ..."}
            className={`w-full bg-white text-sm sm:text-[15px] text-slate-900 font-medium placeholder:text-slate-400 rounded-[20px] border shadow-[0_4px_20px_rgb(0,0,0,0.03)] pl-12 pr-24 py-4 outline-none transition-all duration-200 ${
              isListening ? "border-red-300 ring-4 ring-red-500/10" : "border-slate-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-500/10"
            } disabled:opacity-60`}
          />

          <div className="absolute inset-y-2 right-2 flex items-center gap-1.5">
            {/* Mic Button */}
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={isMagicAdding}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                isListening 
                  ? "bg-red-500 text-white animate-pulse" 
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
              title="Speak task"
            >
              {isListening ? <MicOff size={18} strokeWidth={2.5} /> : <Mic size={18} strokeWidth={2.5} />}
            </button>

            {/* Submit Arrow */}
            <button
              type="submit"
              disabled={isMagicAdding || !magicText.trim()}
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl flex items-center justify-center transition-colors duration-200 shadow-sm"
            >
              {isMagicAdding ? (
                <Loader2 className="animate-spin" size={18} strokeWidth={3} />
              ) : (
                <ArrowUp size={20} strokeWidth={3} />
              )}
            </button>
          </div>
        </form>

        {/* Overdue Banner */}
        {missedTasks.length > 0 && (
          <div className="mb-6 bg-white rounded-[24px] border border-rose-100 shadow-[0_4px_20px_rgb(244,63,94,0.04)] overflow-hidden transition-all duration-200">
            <button
              onClick={() => setIsMissedOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 bg-rose-50/50 hover:bg-rose-50 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                  <AlertCircle size={16} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-rose-900 block leading-tight">
                    Overdue Tasks
                  </span>
                  <span className="text-[11px] text-rose-600 font-medium">
                    {missedTasks.length}{" "}
                    {missedTasks.length === 1 ? "item needs" : "items need"}{" "}
                    attention
                  </span>
                </div>
              </div>
              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                <ChevronDown
                  size={14}
                  strokeWidth={2.5}
                  className={`transition-transform duration-200 ${isMissedOpen ? "rotate-180" : "rotate-0"}`}
                />
              </div>
            </button>

            {isMissedOpen && (
              <div className="p-3 pt-1 grid gap-2.5 max-h-[40vh] overflow-y-auto border-t border-rose-100/60">
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
        <div className="p-1.5 bg-slate-200/60 backdrop-blur-md rounded-2xl mb-6 grid grid-cols-2 gap-1.5 shadow-inner">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 select-none ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={isActive ? "text-blue-600 shrink-0" : "text-slate-400 shrink-0"}
                />
                <span className="inline truncate">{tab.label}</span>
                <span
                  className={`px-1.5 py-0.5 text-[10px] rounded-full font-bold shrink-0 ${
                    isActive
                      ? "bg-blue-50 text-blue-600"
                      : "bg-slate-300/40 text-slate-500"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Task List */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-20 text-slate-400 space-y-3">
            <Loader2 className="animate-spin text-blue-500" size={24} />
            <p className="text-xs font-semibold text-slate-400">
              Loading your workspace...
            </p>
          </div>
        ) : (
          <div className="grid gap-3 mb-8">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3">
                  <Coffee size={22} strokeWidth={2} />
                </div>
                <h3 className="text-slate-900 font-bold text-base mb-1">
                  All Clear
                </h3>
                <p className="text-xs text-slate-400 font-medium max-w-xs">
                  {activeTab === "upcoming"
                    ? "No upcoming tasks found."
                    : "You're all caught up for today. Enjoy your break!"}
                </p>
              </div>
            ) : (
              displayedTasks.map((task) => (
                <TaskCard
                  key={task.id || task._id}
                  task={task}
                  refreshTasks={refreshTasks}
                  isPrevious={false}
                />
              ))
            )}
          </div>
        )}

        {/* Completed Archive Drawer */}
        {completedTasks.length > 0 && (
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden transition-all duration-300">
            <button
              onClick={() => setIsDoneOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-4 px-5 bg-slate-50/60 hover:bg-slate-100/50 transition-colors focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={18} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Completed Archive
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {completedTasks.length}{" "}
                    {completedTasks.length === 1 ? "task finished" : "tasks finished"}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  {completedTasks.length} Done
                </span>
                <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-slate-500 shadow-sm border border-slate-100">
                  <ChevronDown
                    size={14}
                    strokeWidth={2.5}
                    className={`transition-transform duration-200 ${isDoneOpen ? "rotate-180" : "rotate-0"}`}
                  />
                </div>
              </div>
            </button>

            {isDoneOpen && (
              <div className="p-3.5 pt-2 grid gap-2.5 max-h-[45vh] overflow-y-auto border-t border-slate-100 animate-in fade-in duration-200">
                
                {/* --- Sort Dropdown --- */}
                <div className="flex justify-end px-1 pb-1">
                  <div className="relative group">
                    <select
                      value={completedSort}
                      onChange={(e) => setCompletedSort(e.target.value)}
                      className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold py-1.5 pl-3 pr-8 rounded-lg outline-none cursor-pointer border border-transparent hover:border-slate-300 transition-all duration-200"
                    >
                      <option value="date-desc">Date (Newest)</option>
                      <option value="date-asc">Date (Oldest)</option>
                      <option value="title-asc">Name (A-Z)</option>
                      <option value="title-desc">Name (Z-A)</option>
                    </select>
                    <ArrowUpDown 
                      size={12} 
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-600 pointer-events-none transition-colors" 
                      strokeWidth={2.5} 
                    />
                  </div>
                </div>

                {/* --- Mapped Sorted Tasks --- */}
                {sortedCompletedTasks.map((task) => (
                  <TaskCard
                    key={task.id || task._id}
                    task={task}
                    refreshTasks={refreshTasks}
                    isPrevious={true}
                  />
                ))}
                
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}