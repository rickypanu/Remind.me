import React, { useState, useRef, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Calendar,
  AlignLeft,
  Type,
  Tag,
  Loader2,
  CheckCircle2,
  AlertCircle,
  PenTool,
  Clock,
  Repeat,
  CalendarClock,
  CalendarDays,
} from "lucide-react";
import api from "../../utils/api";
import notify from "../../utils/notify";
import { getErrorMessage } from "../../utils/errors";
import usePageMeta from "../../utils/usePageMeta";
import ThemeToggle from "../../components/ThemeToggle";
import { getIstNowInputValue, istInputToUtcIso } from "../../utils/date";

const SCHEDULES = [
  { id: "once", label: "Specific date", icon: CalendarClock },
  { id: "daily", label: "Every day", icon: Repeat },
  { id: "weekly", label: "Every week", icon: CalendarDays },
];

// Backend weekday numbers: 0 = Monday ... 6 = Sunday
const WEEKDAYS = [
  { n: 0, short: "Mon", long: "Monday" },
  { n: 1, short: "Tue", long: "Tuesday" },
  { n: 2, short: "Wed", long: "Wednesday" },
  { n: 3, short: "Thu", long: "Thursday" },
  { n: 4, short: "Fri", long: "Friday" },
  { n: 5, short: "Sat", long: "Saturday" },
  { n: 6, short: "Sun", long: "Sunday" },
];

const fieldBase =
  "w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border border-transparent rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all font-normal min-h-[44px]";

export default function CreateTask() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  usePageMeta({
    title: "New reminder",
    description: "Create a specific, daily or weekly reminder and get notified on Telegram and in your browser.",
    noindex: true,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "Assignment",
    due_date: "",
    time_of_day: "09:00",
    ends_on: "",
  });
  const [scheduleType, setScheduleType] = useState("once");
  const [weekdays, setWeekdays] = useState([]);

  const [customCategory, setCustomCategory] = useState("");
  const customInputRef = useRef(null);

  // `min` for the picker must be IST wall-clock time (toISOString() alone is UTC, 5h30m behind)
  const now = getIstNowInputValue();
  const todayIst = now.slice(0, 10);

  useEffect(() => {
    if (formData.category === "Other" && customInputRef.current) {
      customInputRef.current.focus();
    }
  }, [formData.category]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const toggleDay = (n) => {
    setWeekdays((prev) => (prev.includes(n) ? prev.filter((d) => d !== n) : [...prev, n].sort()));
    setError("");
  };

  const fail = (message) => {
    setError(message);
    notify.error(message);
    setLoading(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    if (!formData.title.trim()) return fail("Please enter a title for your reminder.");
    if (formData.category === "Other" && !customCategory.trim()) {
      return fail("Please specify your custom category.");
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim() || null,
      category: formData.category === "Other" ? customCategory.trim() : formData.category,
      status: "pending",
      schedule_type: scheduleType,
    };

    if (scheduleType === "once") {
      // The picker value is IST wall-clock time -> convert to UTC for storage
      const isoDate = istInputToUtcIso(formData.due_date);
      if (!isoDate) return fail("Please choose a valid due date and time.");
      if (new Date(isoDate) <= new Date()) return fail("Pick a date and time in the future.");
      payload.due_date = isoDate;
    } else {
      if (!formData.time_of_day) return fail("Please choose a time for the reminder.");
      payload.time_of_day = formData.time_of_day; // HH:MM in IST
      if (scheduleType === "weekly") {
        if (weekdays.length === 0) return fail("Pick at least one day of the week.");
        payload.weekdays = weekdays;
      }
      if (formData.ends_on) payload.ends_on = formData.ends_on;
    }

    try {
      await api.post("/tasks/", payload);
      queryClient.invalidateQueries({ queryKey: ["dashboardData"] });

      notify.success(
        scheduleType === "once"
          ? "Reminder created."
          : scheduleType === "daily"
          ? "Daily reminder created."
          : "Weekly reminder created."
      );
      setTimeout(() => navigate("/dashboard"), 700);
    } catch (err) {
      // Includes the server's moderation message when content is rejected
      const message = getErrorMessage(err, "Couldn't create the reminder. Please check the form and try again.");
      setError(message);
      notify.error(message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--rm-page)] pb-12 text-slate-900 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      {/* Navigation Bar */}
      <nav
        className="sticky top-0 z-40 bg-white/70 backdrop-blur-xl border-b border-black/[0.06] px-4 py-3"
        style={{ paddingTop: "calc(0.75rem + env(safe-area-inset-top, 0px))" }}
      >
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-2">
          <Link
            to="/dashboard"
            className="inline-flex items-center min-h-10 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors group active:scale-95"
          >
            <ChevronLeft size={18} className="mr-0.5 -ml-1 transition-transform group-hover:-translate-x-0.5" />
            <span>Back</span>
          </Link>
          <span className="text-sm font-semibold text-slate-900">New Reminder</span>
          <ThemeToggle />
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 sm:px-5 mt-6">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/60 p-5 sm:p-8 shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
          <h1 className="text-2xl font-semibold text-slate-900 mb-1 tracking-tight">Create Reminder</h1>
          <p className="text-sm text-slate-500 mb-6">One time, every day, or on the days you choose.</p>

          {error && (
            <div role="alert" className="mb-6 p-3 px-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 flex items-start gap-2.5 text-sm font-medium">
              <AlertCircle size={16} className="shrink-0 text-rose-500 mt-0.5" />
              <span className="min-w-0 break-words">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                Title
              </label>
              <div className="relative group">
                <Type className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                <input
                  id="title"
                  type="text"
                  name="title"
                  maxLength="100"
                  placeholder="What needs to be done?"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className={fieldBase}
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                Notes <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <div className="relative group">
                <AlignLeft className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                <textarea
                  id="description"
                  name="description"
                  maxLength="500"
                  placeholder="Add details or links"
                  value={formData.description}
                  onChange={handleChange}
                  rows="3"
                  className={`${fieldBase} resize-none`}
                ></textarea>
              </div>
            </div>

            {/* Schedule type */}
            <fieldset>
              <legend className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">When should it remind you?</legend>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100/80" role="radiogroup">
                {SCHEDULES.map(({ id, label, icon: Icon }) => {
                  const active = scheduleType === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => {
                        setScheduleType(id);
                        setError("");
                      }}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 rounded-lg px-1.5 py-2 text-[12px] sm:text-sm font-semibold min-h-[44px] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        active ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="leading-tight text-center">{label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Specific date */}
            {scheduleType === "once" && (
              <div>
                <label htmlFor="due_date" className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                  Date &amp; time (IST)
                </label>
                <div className="relative group w-full">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none z-10" size={17} />
                  <input
                    id="due_date"
                    type="datetime-local"
                    name="due_date"
                    min={now}
                    value={formData.due_date}
                    onChange={handleChange}
                    required
                    className={`${fieldBase} block pr-3 cursor-pointer appearance-none text-left`}
                  />
                </div>
              </div>
            )}

            {/* Daily / weekly */}
            {scheduleType !== "once" && (
              <div className="space-y-4">
                {scheduleType === "weekly" && (
                  <fieldset>
                    <legend className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">Repeat on</legend>
                    <div className="flex flex-wrap gap-2">
                      {WEEKDAYS.map(({ n, short, long }) => {
                        const on = weekdays.includes(n);
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => toggleDay(n)}
                            aria-pressed={on}
                            aria-label={long}
                            className={`h-11 min-w-11 flex-1 sm:flex-none px-3 rounded-xl text-sm font-semibold border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              on
                                ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                                : "bg-white border-slate-200 text-slate-600 hover:border-blue-300 hover:text-blue-700"
                            }`}
                          >
                            {short}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="time_of_day" className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                      Time (IST)
                    </label>
                    <div className="relative group">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none" size={17} />
                      <input
                        id="time_of_day"
                        type="time"
                        name="time_of_day"
                        value={formData.time_of_day}
                        onChange={handleChange}
                        required
                        className={`${fieldBase} block cursor-pointer appearance-none text-left`}
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="ends_on" className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                      Ends on <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative group">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none" size={17} />
                      <input
                        id="ends_on"
                        type="date"
                        name="ends_on"
                        min={todayIst}
                        value={formData.ends_on}
                        onChange={handleChange}
                        className={`${fieldBase} block cursor-pointer appearance-none text-left`}
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {scheduleType === "daily"
                    ? "You'll be reminded every day at this time until you delete it."
                    : "You'll be reminded at this time on each chosen day until you delete it."}{" "}
                  Ticking it off only finishes that day&apos;s reminder.
                </p>
              </div>
            )}

            {/* Category */}
            <div className="space-y-3">
              <div>
                <label htmlFor="category" className="block text-xs font-medium text-slate-500 mb-1.5 ml-0.5">
                  Category
                </label>
                <div className="relative group">
                  <Tag className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors pointer-events-none" size={17} />
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    className={`${fieldBase} pr-8 cursor-pointer`}
                  >
                    <option value="Assignment">Assignment</option>
                    <option value="Project">Project</option>
                    <option value="Exam / Quiz">Exam / Quiz</option>
                    <option value="Placement / Internship">Placement / Internship</option>
                    <option value="Extracurricular">Extracurricular</option>
                    <option value="Personal">Personal</option>
                    <option value="Other">Other (specify)</option>
                  </select>
                </div>
              </div>

              {formData.category === "Other" && (
                <div className="relative group">
                  <PenTool className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" size={17} />
                  <input
                    type="text"
                    ref={customInputRef}
                    maxLength="40"
                    aria-label="Custom category name"
                    placeholder="Custom category name"
                    value={customCategory}
                    onChange={(e) => {
                      setCustomCategory(e.target.value);
                      setError("");
                    }}
                    className={fieldBase}
                  />
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="pt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="flex-1 md:flex-none px-5 py-2.5 bg-slate-100 hover:bg-slate-200/80 text-slate-700 font-medium rounded-xl text-sm transition-all active:scale-[0.98] flex items-center justify-center min-h-[44px]"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading}
                className="flex-[2] md:flex-auto py-2.5 px-5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl text-sm shadow-[0_1px_3px_rgba(37,99,235,0.3)] transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 min-h-[44px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Saving…</span>
                  </>
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
