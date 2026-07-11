import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import toast, { Toaster } from "react-hot-toast";
import {
  ArrowLeft,
  Calendar,
  AlignLeft,
  Type,
  Tag,
  Loader2,
  CheckCircle,
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

  // Prevent selecting past dates by setting the 'min' attribute to right now
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
      
      // Trigger Success Toast
      toast.success("Reminder created successfully!", {
        duration: 2000,
        position: "top-center",
      });

      // Delay navigation slightly so the user sees the success message
      setTimeout(() => {
        navigate("/dashboard");
      }, 1000);

    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Failed to create task. Make sure all required fields are filled."
      );
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24 md:pb-10 relative">
      {/* Toast Container */}
      <Toaster />

      {/* Top Navigation */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-3xl mx-auto flex items-center">
          <Link
            to="/dashboard"
            className="flex items-center text-gray-500 hover:text-blue-600 transition-colors font-medium group"
          >
            <ArrowLeft
              size={20}
              className="mr-2 transform group-hover:-translate-x-1 transition-transform"
            />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-6 sm:p-8 shadow-xl">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-6 tracking-tight">
            Create New Reminder
          </h2>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 flex items-center gap-2 text-sm font-medium animate-in fade-in slide-in-from-top-2">
              <AlertCircle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Reminder Title *
              </label>
              <div className="relative group">
                <Type
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                  size={20}
                />
                <input
                  type="text"
                  name="title"
                  maxLength="100"
                  placeholder="e.g., Study for Finals, Tech Interview Prep..."
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                />
              </div>
            </div>

            {/* Description Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Description (Optional)
              </label>
              <div className="relative group">
                <AlignLeft
                  className="absolute left-4 top-3.5 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                  size={20}
                />
                <textarea
                  name="description"
                  maxLength="500"
                  placeholder="Add any syllabus notes, meeting links, or specific requirements here..."
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all resize-none"
                ></textarea>
              </div>
            </div>

            {/* Grid for Category and Date */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Dropdown & Conditional Custom Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Category *
                  </label>
                  <div className="relative group">
                    <Tag
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                      size={20}
                    />
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleChange}
                      className="w-full pl-12 pr-10 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 appearance-none focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all cursor-pointer"
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
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="relative group">
                      <PenTool
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                        size={20}
                      />
                      <input
                        type="text"
                        ref={customInputRef}
                        placeholder="Type your category here..."
                        value={customCategory}
                        onChange={(e) => {
                          setCustomCategory(e.target.value);
                          setError(""); 
                        }}
                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-blue-100 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Due Date Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Due Date & Time *
                </label>
                <div className="relative group">
                  <Calendar
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-500 transition-colors"
                    size={20}
                  />
                  <input
                    type="datetime-local"
                    name="due_date"
                    min={now} // Validation: Prevents selecting past dates
                    value={formData.due_date}
                    onChange={handleChange}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 focus:bg-white focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons (Sticky on Mobile) */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-10px_15px_-3px_rgba(0,0,0,0.05)] md:static md:p-0 md:bg-transparent md:border-none md:shadow-none z-50 flex gap-4 md:pt-4">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex-1 md:flex-none px-6 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all flex items-center justify-center"
              >
                Cancel
              </button>
              
              <button
                type="submit"
                disabled={loading}
                className="flex-[2] md:flex-auto py-3.5 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={22} />
                ) : (
                  <>
                    <CheckCircle className="mr-2" size={20} />
                    Create Reminder
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