import React, { useEffect, useRef, useState } from "react";
import { X, Check, Repeat, Loader2 } from "lucide-react";
import { istInputToUtcIso, utcToIstInput } from "../utils/date";
import notify from "../utils/notify";

const BASE_CATEGORIES = ["Assignment", "Project", "Exam / Quiz", "Placement / Internship", "Extracurricular", "Personal"];

const field =
  "w-full px-3.5 py-2.5 bg-slate-100/70 border border-transparent rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/10 transition-all min-h-[44px]";

/**
 * Pop-up for editing a reminder (title, notes, category and time). Opens from the pencil button on a
 * card. Saved on this device first, so it works offline.
 */
export default function EditReminderDialog({ task, onClose, onSave }) {
  const recurring = task.schedule_type === "daily" || task.schedule_type === "weekly";
  const categories = BASE_CATEGORIES.includes(task.category) ? BASE_CATEGORIES : [...BASE_CATEGORIES, task.category];
  const [form, setForm] = useState({
    title: task.title || "",
    description: task.description || "",
    category: task.category,
    due_date: utcToIstInput(task.due_date),
    time_of_day: task.time_of_day || "09:00",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef(null);
  const notesRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    titleRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [saving, onClose]);

  // Notes box grows with the text
  useEffect(() => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [form.description]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!form.title.trim()) return setError("Please enter a title.");
    const changes = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
    };
    if (recurring) {
      if (!form.time_of_day) return setError("Please choose a time.");
      changes.time_of_day = form.time_of_day;
    } else {
      const iso = istInputToUtcIso(form.due_date);
      if (!iso) return setError("Please choose a valid date and time.");
      changes.due_date = iso;
    }
    setSaving(true);
    try {
      await onSave(task.id, changes);
      notify.success(navigator.onLine ? "Reminder updated." : "Reminder updated. Saved on this device.");
      onClose();
    } catch {
      setError("Couldn't save that change. Please try again.");
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm sm:p-4"
      onClick={() => !saving && onClose()}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-title"
        onSubmit={submit}
        noValidate
        onClick={(e) => e.stopPropagation()}
        className="rm-modal-in w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-[28px] sm:rounded-[28px] bg-white p-5 sm:p-7 shadow-2xl"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="edit-title" className="text-xl font-bold tracking-tight text-slate-900">Edit reminder</h2>
            {recurring && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                <Repeat size={12} strokeWidth={2.75} /> {task.schedule_label}
              </p>
            )}
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="-mr-2 -mt-1 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <X size={20} strokeWidth={2.25} />
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
        )}

        <div className="space-y-4">
          <div>
            <label htmlFor="e-title" className="mb-1.5 block text-xs font-medium text-slate-500">Title</label>
            <input id="e-title" ref={titleRef} className={field} value={form.title} maxLength={100} onChange={set("title")} />
          </div>
          <div>
            <label htmlFor="e-desc" className="mb-1.5 block text-xs font-medium text-slate-500">Notes</label>
            <textarea id="e-desc" ref={notesRef} rows={2} className={`${field} resize-none`} value={form.description} maxLength={500} onChange={set("description")} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="e-cat" className="mb-1.5 block text-xs font-medium text-slate-500">Category</label>
              <select id="e-cat" className={field} value={form.category} onChange={set("category")}>
                {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="e-when" className="mb-1.5 block text-xs font-medium text-slate-500">
                {recurring ? "Time (IST)" : "Date & time (IST)"}
              </label>
              {recurring ? (
                <input id="e-when" type="time" className={field} value={form.time_of_day} onChange={set("time_of_day")} />
              ) : (
                <input id="e-when" type="datetime-local" className={field} value={form.due_date} onChange={set("due_date")} />
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="flex min-h-[46px] flex-1 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 active:scale-[0.98] disabled:opacity-50">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex min-h-[46px] flex-[1.6] items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white transition hover:bg-blue-700 active:scale-[0.98] disabled:opacity-60">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
