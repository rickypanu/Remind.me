import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Clock,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Megaphone,
  Sparkles,
  Trash2,
  X,
  Eye,
  SendIcon,
  CheckCircle2,
  Edit3
} from "lucide-react";
import api from "../../utils/api";

// Helper to check if a date string is from today
const isToday = (dateString) => {
  if (!dateString) return true; // Fallback for newly created items
  const date = new Date(dateString);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
};

export default function UpdatesPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState({ title: "", content: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // States for preview mode and deletion modals
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
      setError("Please fill in both the title and content before reviewing.");
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
      setIsPreviewMode(false); // Close preview on success

      const res = await api.get("/user/updates");
      const newUpdatesList = res.data;
      setUpdates(newUpdatesList);

      localStorage.setItem("seenUpdatesCount", newUpdatesList.length.toString());
      window.dispatchEvent(new Event("updatesRead"));
    } catch (error) {
      console.error("Failed to post update:", error);
      setError(
        error.response?.data?.detail ||
        "There was an error posting your update."
      );
      setIsPreviewMode(false); // Kick back to edit mode if there's an error
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
      
      const filteredUpdates = updates.filter(u => (u.id || u._id) !== updateId);
      setUpdates(filteredUpdates);

      localStorage.setItem("seenUpdatesCount", filteredUpdates.length.toString());
      window.dispatchEvent(new Event("updatesRead"));
      setDeleteModalTarget(null); // Close modal
    } catch (error) {
      console.error("Failed to delete update:", error);
      setError("Failed to delete the update. Please try again.");
      setDeleteModalTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Group updates
  const todayUpdates = updates.filter(u => isToday(u.created_at));
  const olderUpdates = updates.filter(u => !isToday(u.created_at));

  // Reusable Update Card Component for both the feed and the preview
  const UpdateCard = ({ update, isPreview = false }) => {
    return (
      <div className={`bg-white rounded-3xl p-6 sm:p-8 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] border transition-all duration-300 group relative ${
        isPreview ? 'border-indigo-200 shadow-[0_0_15px_-3px_rgba(99,102,241,0.15)] ring-1 ring-indigo-50' : 'border-zinc-200/80 hover:border-zinc-300'
      }`}>
        {/* Delete Button (Hidden in preview mode) */}
        {!isPreview && currentUser?.is_admin && (
          <button
            onClick={() => setDeleteModalTarget(update)}
            className="absolute top-6 right-6 p-2 text-zinc-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
            title="Delete Update"
          >
            <Trash2 size={18} />
          </button>
        )}

        <div className="flex items-center mb-4">
          <div className="flex items-center text-xs font-semibold text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-lg group-hover:bg-zinc-200 transition-colors">
            <Clock size={14} className="mr-2 text-zinc-400" />
            {isPreview 
              ? "Just now" 
              : update.created_at
                ? new Date(update.created_at).toLocaleDateString("en-US", {
                    year: "numeric", month: "long", day: "numeric",
                  })
                : "Just now"
            }
          </div>
          {isPreview && (
            <span className="ml-3 text-[10px] uppercase tracking-wider font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md">
              Preview
            </span>
          )}
        </div>
        
        <h3 className="text-xl sm:text-2xl font-bold text-zinc-900 mb-3 tracking-tight pr-8 break-words">
          {update.title}
        </h3>
        
        <div className="prose prose-zinc max-w-none">
          <p className="text-zinc-600 leading-relaxed whitespace-pre-wrap break-words">
            {update.content}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] py-8 px-4 sm:px-6 lg:px-8 font-sans selection:bg-zinc-200">
      
      {/* --- Delete Confirmation Modal --- */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-zinc-100 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-5">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Delete Update?</h3>
            <p className="text-sm text-zinc-500 leading-relaxed mb-6">
              Are you sure you want to delete "<span className="font-semibold text-zinc-700">{deleteModalTarget.title}</span>"? This action cannot be undone and will be removed from all users' feeds.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalTarget(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? <Loader2 size={18} className="animate-spin" /> : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-10">
        
        {/* Navigation & Header */}
        <div className="space-y-6">
          <button
            onClick={() => navigate(-1)}
            className="group flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors"
          >
            <span className="p-1.5 rounded-full bg-zinc-100 group-hover:bg-zinc-200 transition-colors">
              <ArrowLeft className="w-4 h-4" /> 
            </span>
            Back to Dashboard
          </button>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-zinc-900 flex items-center justify-center shadow-md shrink-0">
                <Megaphone className="text-white w-6 h-6" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
                  Updates
                </h1>
                <p className="text-sm font-medium text-zinc-500 mt-1">
                  Product announcements and release notes.
                </p>
              </div>
            </div>

            {!isLoading && (
              <div className="flex flex-col items-start sm:items-end bg-white border border-zinc-200/80 px-4 py-2 rounded-2xl shadow-sm">
                <span className="text-2xl font-black text-zinc-900 leading-none">{updates.length}</span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-zinc-400 mt-1">Published</span>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-medium border border-red-100 flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Admin Post Form / Preview Wrapper */}
        {currentUser?.is_admin && (
          <div className="bg-white rounded-3xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] border border-zinc-200/80 overflow-hidden transition-all duration-300 relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500"></div>
            
            <div className="p-6 sm:p-8 space-y-5">
              {!isPreviewMode ? (
                // --- EDIT MODE ---
                <form onSubmit={handleReviewClick} className="space-y-5 animate-in fade-in">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-zinc-900">Draft Announcement</h2>
                  </div>

                  <div className="space-y-4">
                    <input
                      type="text"
                      placeholder="Announcement Title (e.g., Version 2.0 is Live!)"
                      value={newUpdate.title}
                      onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                      className="w-full px-5 py-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:bg-white text-zinc-900 font-semibold focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none placeholder:text-zinc-400 text-lg"
                    />
                    <textarea
                      rows="4"
                      placeholder="What's new? Share the details with your users..."
                      value={newUpdate.content}
                      onChange={(e) => setNewUpdate({ ...newUpdate, content: e.target.value })}
                      className="w-full px-5 py-4 bg-zinc-50 rounded-2xl border border-zinc-200 focus:bg-white text-zinc-900 focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-all outline-none resize-none placeholder:text-zinc-400"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={!newUpdate.title.trim() || !newUpdate.content.trim()}
                      className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white font-semibold rounded-xl transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md"
                    >
                      Review & Preview
                      <SendIcon size={16} />
                    </button>
                  </div>
                </form>
              ) : (
                // --- PREVIEW MODE ---
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-indigo-500" />
                      <h2 className="text-lg font-bold text-zinc-900">Review your update</h2>
                    </div>
                    <button 
                      onClick={() => setIsPreviewMode(false)}
                      disabled={isPosting}
                      className="text-sm font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                      <Edit3 size={14} /> Edit Draft
                    </button>
                  </div>

                  {/* Render the card preview */}
                  <UpdateCard update={newUpdate} isPreview={true} />

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { setNewUpdate({ title: '', content: '' }); setIsPreviewMode(false); }}
                      disabled={isPosting}
                      className="px-6 py-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold rounded-xl transition-colors disabled:opacity-50"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handlePostUpdate}
                      disabled={isPosting}
                      className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl transition-all hover:bg-indigo-700 disabled:opacity-70 shadow-md hover:shadow-lg"
                    >
                      {isPosting ? (
                        <>
                          <Loader2 size={18} className="animate-spin" /> Publishing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={18} /> Confirm & Publish
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Public Feed Section */}
        <div className="space-y-10">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin mb-4 text-zinc-300" />
              <p className="font-medium text-sm tracking-wide">Fetching latest updates...</p>
            </div>
          ) : updates.length > 0 ? (
            <div className="space-y-10">
              
              {/* TODAY'S UPDATES */}
              {todayUpdates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="h-px bg-zinc-200 flex-1"></div>
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Today</h2>
                    <div className="h-px bg-zinc-200 flex-1"></div>
                  </div>
                  <div className="space-y-6">
                    {todayUpdates.map(update => (
                      <UpdateCard key={update.id || update._id} update={update} />
                    ))}
                  </div>
                </div>
              )}

              {/* EARLIER / OLDER UPDATES */}
              {olderUpdates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <div className="h-px bg-zinc-200 flex-1"></div>
                    <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Earlier</h2>
                    <div className="h-px bg-zinc-200 flex-1"></div>
                  </div>
                  <div className="space-y-6">
                    {olderUpdates.map(update => (
                      <UpdateCard key={update.id || update._id} update={update} />
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            /* EMPTY STATE */
            <div className="bg-white rounded-3xl p-12 text-center border border-zinc-200/80 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-400 flex items-center justify-center mx-auto mb-4">
                <Megaphone size={24} />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 mb-1">No updates yet</h3>
              <p className="text-zinc-500 text-sm max-w-sm mx-auto">
                Check back later for news, product announcements, and release notes.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}