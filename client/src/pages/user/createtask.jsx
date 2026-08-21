import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  ChevronLeft,
  Calendar,
  AlignLeft,
  Type,
  Tag,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PenTool
} from "lucide-react";
import api from "../../utils/api";

export default function CreateTask() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Assignment",
    due_date: "",
  });

  const [customCategory, setCustomCategory] = useState("");
  const customInputRef = useRef(null);

  const now = new Date().toISOString().slice(0, 16);

  useEffect(() => {
    if (formData.category === "Other" && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [formData.category]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.category === "Other" && !customCategory.trim()) {
      setError("Please specify your custom category.");
      setLoading(false);
      return;
    }

    try {
      const isoDate = new Date(formData.due_date).toISOString();
      const finalCategory = formData.category === "Other" ? customCategory.trim() : formData.category;

      const payload = {
        title: formData.title,
        description: formData.description,
        category: finalCategory,
        due_date: isoDate,
        status: "pending",
      };

      await api.post("/tasks/", payload);
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });

      toast.success("Reminder created", {
        duration: 2000,
        position: "top-center",
        style: {
          borderRadius: "9999px",
          background: "#1E293B",
          color: "#fff",
          fontSize: "13px",
          fontWeight: "500",
        },
      });

      setTimeout(() => {
        navigate("/dashboard");
      }, 800);

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to create task. Make sure all required fields are filled."
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] pb-28 md:pb-12 text-slate-900 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      <Toaster />

      {/* iOS-Style Navigation Bar */}
      <nav className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-black/[0.06] px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Link
            to="/dashboard"
            className="inline-flex items-center text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors group active:scale-95"
          >
            <ChevronLeft
              size={18}
              className="mr-0.5 -ml-1 transition-transform group-hover:-translate-x-0.5"
            />
            <span>Dashboard</span>
          </Link>
          <span className="text-xs font-semibold text-slate-900">New Reminder</span>
          <div className="w-12"></div>
        </div>
      </nav>

      {/* Main Content Container */}
      <main className="max-w-xl mx-auto px-5 mt-8">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 p-6 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <h1 className="text-2xl font-semibold text-slate-900 mb-6 tracking-tight">
            Create Reminder
          </h1>

          {error && (
            <div className="mb-6 p-3 px-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-center gap-2.5 text-xs font-medium">
              <AlertCircle size={16} className="shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Title Input */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                Title
              </label>
              <div className="relative group">
                <Type
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                  size={17}
                />
                <input
                  type="text"
                  name="title"
                  maxLength="100"
                  placeholder="What needs to be done?"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border border-transparent rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-normal"
                />
              </div>
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                Notes <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <div className="relative group">
                <AlignLeft
                  className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                  size={17}
                />
                <textarea
                  name="description"
                  maxLength="500"
                  placeholder="Add details or links..."
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border border-transparent rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all resize-none font-normal"
                ></textarea>
              </div>
            </div>

            {/* Category and Date Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Category Dropdown */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                    Category
                  </label>
                  <div className="relative group">
                    <Tag
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                      size={17}
                    />
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full pl-10 pr-8 py-2.5 bg-slate-100/70 border border-transparent rounded-xl text-xs sm:text-sm text-slate-900 appearance-none focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all cursor-pointer font-normal"
                    >
                      <option value="Assignment">Assignment</option>
                      <option value="Project">Project</option>
                      <option value="Exam / Quiz">Exam / Quiz</option>
                      <option value="Placement / Internship">Placement / Internship</option>
                      <option value="Extracurricular">Extracurricular</option>
                      <option value="Personal">Personal</option>
                      <option value="Other">Other (Specify)</option>
                    </select>
                  </div>
                </div>

                {formData.category === "Other" && (
                  <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="relative group">
                      <PenTool
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                        size={17}
                      />
                      <input
                        type="text"
                        ref={customInputRef}
                        placeholder="Custom category name"
                        value={customCategory}
                        onChange={(e) => {
                          setCustomCategory(e.target.value);
                          setError(""); 
                        }}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-blue-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Due Date Input */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                  Due Date
                </label>
                <div className="relative group">
                  <Calendar
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors"
                    size={17}
                  />
                  <input
                    type="datetime-local"
                    name="due_date"
                    min={now}
                    value={formData.due_date}
                    onChange={handleChange}
                    required
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border border-transparent rounded-xl text-xs sm:text-sm text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-normal"
                  />
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-xl border-t border-slate-200/60 md:static md:p-0 md:bg-transparent md:border-none md:shadow-none z-40 flex items-center gap-3 md:pt-4">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex-1 md:flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium rounded-xl text-xs sm:text-sm transition-all active:scale-[0.98] flex items-center justify-center"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] md:flex-auto py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-xs sm:text-sm shadow-[0_1px_3px_rgba(37,99,235,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <>
                    <CheckCircle2 size={16} strokeWidth={2.2} />
                    <span>Create Reminder</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}