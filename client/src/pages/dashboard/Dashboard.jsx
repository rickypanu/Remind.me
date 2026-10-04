import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { useNavigate, Link } from "react-router-dom";
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
  ArrowUpDown,
  Plus,
  Square,
} from "lucide-react";
import api from "../../utils/api";
import { parseDueDate } from "../../utils/date";
import TaskCard from "../tasks/TaskCard";
import Header from "../components/Header";

// Placeholder cards shown while loading
function TaskSkeleton() {
  return (
    <div className="p-5 rounded-[24px] border border-slate-100 bg-white animate-pulse motion-reduce:animate-none flex gap-4">
      <div className="w-6 h-6 rounded-full bg-slate-100 shrink-0" />
      <div className="flex-1 space-y-3">
        <div className="h-3 w-24 rounded bg-slate-100" />
        <div className="h-4 w-3/4 rounded bg-slate-100" />
        <div className="h-3 w-1/2 rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("today");
  const [isMissedOpen, setIsMissedOpen] = useState(false);
  const [isDoneOpen, setIsDoneOpen] = useState(false);

  // Toast: { text, type: "success" | "error" }
  const [toast, setToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Magic Add
  const [magicText, setMagicText] = useState("");
  const [isMagicAdding, setIsMagicAdding] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("en-IN");
  const recognitionRef = useRef(null);

  const [completedSort, setCompletedSort] = useState("date-desc");

  // --- Toast helper: clears the previous timer so rapid actions don't hide each other ---
  const showToast = useCallback((text, type = "success", duration = 3500) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ text, type });
    toastTimeoutRef.current = setTimeout(() => setToast(null), duration);
  }, []);

  // Clean up timers / mic on unmount
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
      recognitionRef.current?.abort?.();
    };
  }, []);

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
    if (isError && error?.response?.status === 401) handleLogout();
  }, [isError, error, handleLogout]);

  const userInfo = data?.userInfo || null;
  const tasks = useMemo(() => data?.tasks || [], [data]);

  // Passed to TaskCard: (message, type)
  const refreshTasks = useCallback(
    (message, type = "success") => {
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      const text =
        typeof message === "string" ? message : "Task marked complete!";
      showToast(text, type);
    },
    [queryClient, showToast],
  );

  // --- Voice Input ---
  const handleVoiceInput = () => {
    // Tap again while listening to stop
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast(
        "❌ Voice input is not supported in this browser.",
        "error",
        3000,
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = voiceLang;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      setMagicText(event.results[0][0].transcript);
    };
    recognition.onerror = (event) => {
      // "no-speech" and "aborted" are normal; only surface real failures
      if (event.error !== "no-speech" && event.error !== "aborted") {
        showToast(
          "❌ Mic access error. Check your browser permissions.",
          "error",
          3000,
        );
      }
    };
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  // --- Magic Add ---
  const handleMagicAdd = async (e) => {
    e.preventDefault();
    if (!magicText.trim() || isMagicAdding) return;

    setIsMagicAdding(true);
    try {
      await api.post("/tasks/magic-add", { text: magicText });
      setMagicText("");
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
      showToast("✨ Task added!");
    } catch (err) {
      console.error("Magic Add failed:", err);
      showToast(
        "❌ Couldn't understand that task. Try rephrasing it.",
        "error",
      );
    } finally {
      setIsMagicAdding(false);
    }
  };

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 6) return "Late night grind";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  // --- Task Categorization (uses the same date parser as TaskCard) ---
  const {
    missedTasks,
    todayTasks,
    upcomingTasks,
    completedTasks,
    doneTodayCount,
  } = useMemo(() => {
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
    let doneToday = 0;

    tasks.forEach((task) => {
      const due = parseDueDate(task.due_date);
      const dueMs = due ? due.getTime() : null;

      if (task.status === "completed") {
        completed.push(task);
        if (dueMs !== null && dueMs >= startOfToday && dueMs <= endOfToday)
          doneToday++;
        return;
      }

      if (dueMs === null) upcoming.push(task);
      else if (dueMs < startOfToday) missed.push(task);
      else if (dueMs <= endOfToday) today.push(task);
      else upcoming.push(task);
    });

    return {
      missedTasks: missed,
      todayTasks: today,
      upcomingTasks: upcoming,
      completedTasks: completed,
      doneTodayCount: doneToday,
    };
  }, [tasks]);

  const totalToday = todayTasks.length + doneTodayCount;
  const progressPct = totalToday
    ? Math.round((doneTodayCount / totalToday) * 100)
    : 0;

  const sortedCompletedTasks = useMemo(() => {
    return [...completedTasks].sort((a, b) => {
      const dateA = parseDueDate(a.due_date)?.getTime() ?? 0;
      const dateB = parseDueDate(b.due_date)?.getTime() ?? 0;
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
    if (missedTasks.length === 0) setIsMissedOpen(false);
  }, [missedTasks.length]);

  const displayedTasks = activeTab === "upcoming" ? upcomingTasks : todayTasks;

  const tabs = [
    { id: "today", label: "Today", count: todayTasks.length, icon: Sun },
    {
      id: "upcoming",
      label: "Upcoming",
      count: upcomingTasks.length,
      icon: CalendarDays,
    },
  ];

  // Different icon + copy per tab
  const emptyState =
    activeTab === "upcoming"
      ? {
          Icon: CalendarDays,
          title: "Nothing planned yet",
          body: "Add a reminder to plan ahead.",
          cta: "Add a reminder",
        }
      : {
          Icon: Coffee,
          title: "Nothing due today",
          body: "You're all caught up. Enjoy your break!",
          cta: "Add a reminder",
        };

  const isError_ = toast?.type === "error";

  return (
    <div className="min-h-screen bg-[#FAFAFC] pb-28 text-slate-900 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','Helvetica_Neue',sans-serif] relative overflow-x-hidden">
      {/* Toast (sits above the mobile FAB) */}
      <div aria-live="polite" role="status" className="contents">
        {toast && (
          <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-2rem)] bg-slate-900 text-white px-5 py-3 rounded-full shadow-2xl flex items-center gap-2.5 text-sm font-semibold animate-in fade-in slide-in-from-bottom-5 duration-300 motion-reduce:animate-none border border-slate-800">
            <div
              className={`w-5 h-5 rounded-full flex items-center justify-center text-white shrink-0 ${
                isError_ ? "bg-red-500" : "bg-emerald-500"
              }`}
            >
              {isError_ ? (
                <AlertCircle size={12} strokeWidth={3} />
              ) : (
                <Check size={12} strokeWidth={3} />
              )}
            </div>
            <span>{toast.text}</span>
          </div>
        )}
      </div>

      <Header />

      <main className="max-w-xl mx-auto px-5 sm:px-6">
        {/* Greeting + progress */}
        <div className="pt-10 pb-6">
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

        {/* Magic Add with voice */}
        <form onSubmit={handleMagicAdd} className="mb-2 relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Sparkles
              className="text-blue-400 group-focus-within:text-blue-600 transition-colors duration-200"
              size={20}
              strokeWidth={2.5}
            />
          </div>

          <input
            type="text"
            value={magicText}
            onChange={(e) => setMagicText(e.target.value)}
            disabled={isMagicAdding || isListening}
            aria-label="Add a task by typing or speaking"
            placeholder={
              isListening ? "Listening..." : "e.g. Submit report tomorrow 5pm"
            }
            className={`w-full bg-white text-sm sm:text-[15px] text-slate-900 font-medium placeholder:text-slate-400 rounded-[20px] border shadow-[0_4px_20px_rgb(0,0,0,0.03)] pl-12 pr-28 py-4 outline-none transition-all duration-200 ${
              isListening
                ? "border-red-300 ring-4 ring-red-500/10"
                : "border-slate-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-500/10"
            } disabled:opacity-60`}
          />

          <div className="absolute inset-y-2 right-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleVoiceInput}
              disabled={isMagicAdding}
              aria-label={isListening ? "Stop listening" : "Speak a task"}
              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                isListening
                  ? "bg-red-500 text-white animate-pulse motion-reduce:animate-none"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-600"
              }`}
            >
              {isListening ? (
                <MicOff size={18} strokeWidth={2.5} />
              ) : (
                <Mic size={18} strokeWidth={2.5} />
              )}
            </button>

            <button
              type="submit"
              disabled={isMagicAdding || !magicText.trim()}
              aria-label="Add task"
              className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl flex items-center justify-center transition-colors duration-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
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
              aria-expanded={isMissedOpen}
              className="w-full flex items-center justify-between p-4 bg-rose-50/50 hover:bg-rose-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-300"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-rose-500 text-white flex items-center justify-center shadow-sm">
                  <AlertCircle size={16} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-rose-900 block leading-tight">
                    Overdue tasks
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

        {/* Tabs */}
        <div
          role="tablist"
          className="p-1.5 bg-slate-200/60 backdrop-blur-md rounded-2xl mb-6 grid grid-cols-2 gap-1.5 shadow-inner"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full py-2.5 px-3 text-xs sm:text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                <Icon
                  size={17}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={
                    isActive
                      ? "text-blue-600 shrink-0"
                      : "text-slate-400 shrink-0"
                  }
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
          <div
            className="grid gap-3 mb-8"
            aria-busy="true"
            aria-label="Loading tasks"
          >
            <TaskSkeleton />
            <TaskSkeleton />
            <TaskSkeleton />
          </div>
        ) : isError && error?.response?.status !== 401 ? (
          <div className="text-center py-12 px-6 bg-white rounded-[24px] border border-rose-100 mb-8">
            <AlertCircle className="mx-auto text-rose-500 mb-3" size={24} />
            <h3 className="text-slate-900 font-bold text-base mb-1">
              Couldn't load your tasks
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-4">
              Check your connection and try again.
            </p>
            <button
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["dashboardData"] })
              }
              className="px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-full active:scale-95 transition-transform"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="grid gap-3 mb-8">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-14 px-6 bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.02)] flex flex-col items-center justify-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mb-3">
                  <emptyState.Icon size={22} strokeWidth={2} />
                </div>
                <h3 className="text-slate-900 font-bold text-base mb-1">
                  {emptyState.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium max-w-xs mb-4">
                  {emptyState.body}
                </p>
                <Link
                  to="/create-task"
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full shadow-sm active:scale-95 transition-all"
                >
                  <Plus size={16} strokeWidth={2.5} />
                  {emptyState.cta}
                </Link>
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

        {/* Completed Archive */}
        {completedTasks.length > 0 && (
          <div className="bg-white rounded-[24px] border border-slate-100 shadow-[0_4px_20px_rgb(0,0,0,0.03)] overflow-hidden transition-all duration-300">
            <button
              onClick={() => setIsDoneOpen((prev) => !prev)}
              aria-expanded={isDoneOpen}
              className="w-full flex items-center justify-between p-4 px-5 bg-slate-50/60 hover:bg-slate-100/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-300"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
                  <CheckCircle2 size={18} strokeWidth={2.5} />
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-900 block leading-tight">
                    Completed archive
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {completedTasks.length}{" "}
                    {completedTasks.length === 1
                      ? "task finished"
                      : "tasks finished"}
                  </span>
                </div>
              </div>

              <div className="w-6 h-6 flex items-center justify-center rounded-full bg-white text-slate-500 shadow-sm border border-slate-100">
                <ChevronDown
                  size={14}
                  strokeWidth={2.5}
                  className={`transition-transform duration-200 ${isDoneOpen ? "rotate-180" : "rotate-0"}`}
                />
              </div>
            </button>

            {isDoneOpen && (
              <div className="p-3.5 pt-2 grid gap-2.5 max-h-[45vh] overflow-y-auto border-t border-slate-100 animate-in fade-in duration-200 motion-reduce:animate-none">
                <div className="flex justify-end px-1 pb-1">
                  <div className="relative group">
                    <select
                      value={completedSort}
                      onChange={(e) => setCompletedSort(e.target.value)}
                      aria-label="Sort completed tasks"
                      className="appearance-none bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold py-1.5 pl-3 pr-8 rounded-lg outline-none cursor-pointer border border-transparent hover:border-slate-300 focus-visible:ring-2 focus-visible:ring-blue-500 transition-all duration-200"
                    >
                      <option value="date-desc">Date (newest)</option>
                      <option value="date-asc">Date (oldest)</option>
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

      {/* Mobile FAB (the header "+" is hard to reach with a thumb) */}
      <Link
        to="/create-task"
        aria-label="New reminder"
        className="md:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-lg shadow-blue-600/30 active:scale-90 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        <Plus size={26} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
