import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  Loader2,
  Trash2,
  Eye,
  CheckCircle2,
  Edit3,
  Megaphone,
} from "lucide-react";
import api from "../../utils/api";

// Helper to check if a date string is from today
const isToday = (dateString) => {
  if (!dateString) return true;
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

const monthKey = (dateString) =>
  dateString
    ? new Date(dateString).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Single entry on the timeline. Defined outside the page so it doesn't remount on every render.
function Entry({ update, isPreview = false, isLatest = false, canDelete = false, onDelete }) {
  const date = update.created_at && !isPreview ? new Date(update.created_at) : new Date();
  const today = isPreview || isToday(update.created_at);

  return (
    <article className="group relative grid grid-cols-[1fr] sm:grid-cols-[112px_1fr] gap-x-10 gap-y-3">
      {/* Date column */}
      <div className="sm:text-right sm:pt-1.5 flex sm:block items-baseline gap-2">
        <div className="text-[15px] font-semibold text-slate-900 tabular-nums">
          {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
        </div>
        <div className="text-xs text-slate-400 font-medium sm:mt-0.5">
          {today ? (isPreview ? "Preview" : "Today") : date.getFullYear()}
        </div>
      </div>

      {/* Rail dot (desktop) */}
      <span
        aria-hidden="true"
        className={`hidden sm:block absolute left-[112px] top-[11px] -translate-x-[calc(50%-20px)] h-2.5 w-2.5 rounded-full ${
          isLatest || isPreview
            ? "bg-indigo-600 ring-4 ring-indigo-600/15"
            : "bg-white border-2 border-slate-300"
        }`}
      />

      {/* Content */}
      <div className="sm:pl-10 sm:border-l sm:border-slate-200/80 pb-14 relative">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-[22px] sm:text-2xl font-semibold tracking-[-0.02em] leading-snug text-slate-900 break-words">
            {update.title || "Untitled update"}
          </h3>
          {canDelete && (
            <button
              onClick={() => onDelete(update)}
              className="shrink-0 -mt-1 p-2 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              aria-label="Delete update"
              title="Delete update"
            >
              <Trash2 size={17} />
            </button>
          )}
        </div>
        <p className="mt-3 max-w-[62ch] text-[15.5px] leading-[1.75] text-slate-600 whitespace-pre-wrap break-words">
          {update.content}
        </p>
      </div>
    </article>
  );
}

export default function UpdatesPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState({ title: "", content: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [isPosting, setIsPosting] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [deleteModalTarget, setDeleteModalTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [profileRes, updatesRes] = await Promise.allSettled([
          api.get("/user/me"),
          api.get("/user/updates"),
        ]);

        if (profileRes.status === "fulfilled") {
          setCurrentUser(profileRes.value.data);
        }

        if (updatesRes.status === "fulfilled") {
          const fetchedUpdates = updatesRes.value.data;
          setUpdates(fetchedUpdates);

          localStorage.setItem("seenUpdatesCount", fetchedUpdates.length.toString());
          window.dispatchEvent(new Event("updatesRead"));
        }
      } catch (error) {
        console.error("Failed to fetch page data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleReviewClick = (e) => {
    e.preventDefault();
    setError("");
    if (!newUpdate.title.trim() || !newUpdate.content.trim()) {
      setError("Add a title and details before reviewing.");
      return;
    }
    setIsPreviewMode(true);
  };

  const handlePostUpdate = async () => {
    setError("");
    setIsPosting(true);

    try {
      await api.post("/user/updates", newUpdate);

      setNewUpdate({ title: "", content: "" });
      setIsPreviewMode(false);

      const res = await api.get("/user/updates");
      const newUpdatesList = res.data;
      setUpdates(newUpdatesList);

      localStorage.setItem("seenUpdatesCount", newUpdatesList.length.toString());
      window.dispatchEvent(new Event("updatesRead"));
    } catch (error) {
      console.error("Failed to post update:", error);
      setError(error.response?.data?.detail || "Couldn't publish your update. Try again.");
      setIsPreviewMode(false);
    } finally {
      setIsPosting(false);
    }
  };

  const executeDelete = async () => {
    if (!deleteModalTarget) return;

    setIsDeleting(true);
    setError("");
    const updateId = deleteModalTarget.id || deleteModalTarget._id;

    try {
      await api.delete(`/user/updates/${updateId}`);

      const filteredUpdates = updates.filter((u) => (u.id || u._id) !== updateId);
      setUpdates(filteredUpdates);

      localStorage.setItem("seenUpdatesCount", filteredUpdates.length.toString());
      window.dispatchEvent(new Event("updatesRead"));
      setDeleteModalTarget(null);
    } catch (error) {
      console.error("Failed to delete update:", error);
      setError("Couldn't delete the update. Try again.");
      setDeleteModalTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Group updates by month, keeping the incoming order
  const groups = [];
  updates.forEach((u) => {
    const key = monthKey(u.created_at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(u);
    else groups.push({ key, items: [u] });
  });
  const latestId = updates.length ? updates[0].id || updates[0]._id : null;
  const canPublish = newUpdate.title.trim() && newUpdate.content.trim();

  return (
    <div className="min-h-screen bg-[#F6F7FA] text-slate-900 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      {/* Delete confirmation */}
      {deleteModalTarget && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200"
        >
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full shadow-[0_24px_60px_-12px_rgba(15,23,42,0.35)] ring-1 ring-slate-900/5 animate-in zoom-in-95 duration-200">
            <h3 className="text-lg font-semibold tracking-tight">Delete this update?</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              <span className="font-medium text-slate-800">{deleteModalTarget.title}</span> will be
              removed for everyone. You can't undo this.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteModalTarget(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Delete update"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-10 pb-24">
        {/* Header */}
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 rounded-md"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <header className="mt-10 mb-14 flex items-end justify-between gap-6">
          <div>
            <h1 className="text-5xl sm:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] text-slate-900">
              What's new
            </h1>
            <p className="mt-4 text-base text-slate-500 max-w-md leading-relaxed">
              Product announcements and release notes, newest first.
            </p>
          </div>
          {!isLoading && (
            <div className="hidden sm:block text-right shrink-0 pb-1">
              <div className="text-3xl font-semibold tabular-nums tracking-tight">{updates.length}</div>
              <div className="text-xs text-slate-400 font-medium">
                {updates.length === 1 ? "update" : "updates"}
              </div>
            </div>
          )}
        </header>

        {error && (
          <div
            role="alert"
            className="mb-8 flex items-start gap-3 rounded-xl bg-red-50 text-red-700 px-4 py-3 text-sm font-medium ring-1 ring-red-100"
          >
            <AlertCircle size={18} className="shrink-0 mt-px" />
            <span>{error}</span>
          </div>
        )}

        {/* Admin composer */}
        {currentUser?.is_admin && (
          <section className="mb-16 rounded-3xl bg-white ring-1 ring-slate-900/[0.06] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_48px_-24px_rgba(15,23,42,0.14)]">
            {!isPreviewMode ? (
              <form onSubmit={handleReviewClick} className="animate-in fade-in">
                <div className="px-7 sm:px-9 pt-8 pb-4">
                  <input
                    type="text"
                    placeholder="Announcement title"
                    value={newUpdate.title}
                    onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                    className="w-full bg-transparent text-2xl sm:text-3xl font-semibold tracking-[-0.025em] text-slate-900 placeholder:text-slate-300 outline-none"
                  />
                  <textarea
                    rows="5"
                    placeholder="Describe what changed and why it matters to people using the product."
                    value={newUpdate.content}
                    onChange={(e) => setNewUpdate({ ...newUpdate, content: e.target.value })}
                    className="mt-4 w-full bg-transparent text-[15.5px] leading-[1.75] text-slate-700 placeholder:text-slate-300 outline-none resize-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-4 px-7 sm:px-9 py-4 border-t border-slate-100">
                  <span className="text-xs text-slate-400 font-medium">
                    You'll see a preview before it goes live.
                  </span>
                  <button
                    type="submit"
                    disabled={!canPublish}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold transition-colors disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/50 focus-visible:ring-offset-2"
                  >
                    Preview update
                    <ArrowUp size={15} className="rotate-45" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="animate-in fade-in">
                <div className="flex items-center justify-between px-7 sm:px-9 pt-7">
                  <div className="flex items-center gap-2 text-sm font-semibold text-indigo-700">
                    <Eye size={17} /> Preview
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPreviewMode(false)}
                    disabled={isPosting}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
                  >
                    <Edit3 size={14} /> Keep editing
                  </button>
                </div>

                <div className="px-7 sm:px-9 pt-8">
                  <Entry update={newUpdate} isPreview />
                </div>

                <div className="flex items-center justify-between gap-3 px-7 sm:px-9 py-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setNewUpdate({ title: "", content: "" });
                      setIsPreviewMode(false);
                    }}
                    disabled={isPosting}
                    className="px-4 py-2.5 rounded-full text-sm font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors disabled:opacity-50"
                  >
                    Discard draft
                  </button>
                  <button
                    type="button"
                    onClick={handlePostUpdate}
                    disabled={isPosting}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors disabled:opacity-70 shadow-[0_8px_20px_-8px_rgba(79,70,229,0.7)]"
                  >
                    {isPosting ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Publishing
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Publish
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Feed */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin mb-3 text-indigo-500" />
            <p className="text-sm font-medium">Loading updates</p>
          </div>
        ) : updates.length > 0 ? (
          <div>
            {groups.map((group) => (
              <section key={group.key}>
                <h2 className="mb-8 sm:pl-[152px] text-sm font-semibold text-slate-400">
                  {group.key}
                </h2>
                {group.items.map((update) => {
                  const id = update.id || update._id;
                  return (
                    <Entry
                      key={id}
                      update={update}
                      isLatest={id === latestId}
                      canDelete={!!currentUser?.is_admin}
                      onDelete={setDeleteModalTarget}
                    />
                  );
                })}
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 px-8 py-16 text-center">
            <div className="mx-auto mb-4 h-11 w-11 rounded-full bg-white ring-1 ring-slate-200 flex items-center justify-center text-slate-400">
              <Megaphone size={20} />
            </div>
            <h3 className="text-base font-semibold text-slate-900">No updates yet</h3>
            <p className="mt-1.5 text-sm text-slate-500 max-w-xs mx-auto leading-relaxed">
              New features and release notes will show up here as soon as they're published.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}