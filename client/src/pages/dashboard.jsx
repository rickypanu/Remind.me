import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  LayoutDashboard,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import api from "../utils/api";
import TaskCard from "../components/TaskCard";

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("today");
  
  // We need this to manually trigger a refresh when a task is updated on the dashboard
  const queryClient = useQueryClient(); 

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  // --- React Query Data Fetching ---
  const { 
    data, 
    isLoading: loading, 
    isError, 
    error 
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
    // Keep data fresh for 5 minutes (adjust as needed)
    staleTime: 5 * 60 * 1000, 
    // Don't retry if the request fails due to authentication
    retry: (failureCount, error) => error.response?.status !== 401,
  });

  // Handle unauthorized errors (redirect to login)
  useEffect(() => {
    if (isError && error.response?.status === 401) {
      handleLogout();
    }
  }, [isError, error]);

  // Handle missing token check
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) navigate("/");
  }, [navigate]);

  // Extract data from the query result (fallback to empty arrays/null if undefined)
  const userInfo = data?.userInfo || null;
  const tasks = data?.tasks || [];

  // A function to pass to TaskCard so it can refresh the list if a task is deleted/completed
  const refreshTasks = () => {
    queryClient.invalidateQueries({ queryKey: ["dashboardData"] });
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

  const todayTasks = tasks.filter((task) => {
    const dueDate = new Date(task.due_date);
    return (
      dueDate >= startOfToday &&
      dueDate <= endOfToday &&
      task.status === "pending"
    );
  });

  const upcomingTasks = tasks.filter((task) => {
    const dueDate = new Date(task.due_date);
    return dueDate > endOfToday && task.status === "pending";
  });

  const previousTasks = tasks.filter((task) => {
    const dueDate = new Date(task.due_date);
    return dueDate < startOfToday || task.status === "completed";
  });

  const displayedTasks =
    activeTab === "today"
      ? todayTasks
      : activeTab === "upcoming"
        ? upcomingTasks
        : previousTasks;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 1. Global Navigation */}
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
            className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-full transition-colors"
          >
            <UserIcon size={16} className="text-gray-500" />
            <span>{userInfo?.username || "Profile"}</span>
          </Link>
        </div>
      </nav>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4">
        {/* 2. Workspace Header */}
        <div className="flex items-end justify-between mt-6 mb-6">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
            </p>
            <h2 className="text-2xl font-black text-gray-900 mt-0.5">
              Hello, {userInfo?.username?.split(" ")[0] || "there"} 👋
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

        {/* 3. The Content (Tabs & List) */}
        <div className="flex space-x-2 bg-gray-200/50 p-1.5 rounded-xl mb-6 border border-gray-200">
          <button
            onClick={() => setActiveTab("today")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex justify-center items-center gap-2 ${
              activeTab === "today"
                ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            }`}
          >
            Today
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "today" ? "bg-gray-100 text-gray-700" : "bg-gray-200 text-gray-500"}`}>
              {todayTasks.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("upcoming")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex justify-center items-center gap-2 ${
              activeTab === "upcoming"
                ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            }`}
          >
            Upcoming
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "upcoming" ? "bg-gray-100 text-gray-700" : "bg-gray-200 text-gray-500"}`}>
              {upcomingTasks.length}
            </span>
          </button>
          
          <button
            onClick={() => setActiveTab("previous")}
            className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all flex justify-center items-center gap-2 ${
              activeTab === "previous"
                ? "bg-white text-gray-900 shadow-sm border border-gray-200/50"
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            }`}
          >
            History
            <span className={`px-2 py-0.5 rounded-full text-xs ${activeTab === "previous" ? "bg-gray-100 text-gray-700" : "bg-gray-200 text-gray-500"}`}>
              {previousTasks.length}
            </span>
          </button>
        </div>

        {/* Task List */}
        {loading ? (
          <div className="flex justify-center items-center py-20 text-blue-600">
            <Loader2 className="animate-spin" size={32} />
          </div>
        ) : (
          <div className="grid gap-4">
            {displayedTasks.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border-2 border-gray-200 border-dashed">
                <p className="text-gray-500 font-medium text-lg">
                  No reminders found in this section.
                </p>
                {activeTab !== "previous" && (
                  <p className="text-sm text-gray-400 mt-1">
                    Time to relax or get ahead!
                  </p>
                )}
              </div>
            ) : (
              displayedTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  refreshTasks={refreshTasks}
                  isPrevious={activeTab === "previous"}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}