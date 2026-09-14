import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock,
  AlertCircle,
  ArrowLeft,
  Loader2,
  Megaphone,
  Sparkles,
  Trash2,
  Eye,
  SendIcon,
  CheckCircle2,
  Edit3
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
      setIsPreviewMode(false);

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
      
      const filteredUpdates = updates.filter(u => (u.id || u._id) !== updateId);
      setUpdates(filteredUpdates);

      localStorage.setItem("seenUpdatesCount", filteredUpdates.length.toString());
      window.dispatchEvent(new Event("updatesRead"));
      setDeleteModalTarget(null);
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

  // Reusable Update Card Component
  const UpdateCard = ({ update, isPreview = false }) => {
    return (
      <div className={`bg-white rounded-[24px] p-6 sm:p-8 transition-all duration-300 group relative shadow-[0_4px_20px_rgb(0,0,0,0.03)] border ${
        isPreview 
          ? 'border-blue-200 ring-2 ring-blue-500/10' 
          : 'border-gray-100 hover:border-gray-200'
      }`}>
        {/* Delete Button */}
        {!isPreview && currentUser?.is_admin && (
          <button
            onClick={() => setDeleteModalTarget(update)}
            className="absolute top-6 right-6 p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
            title="Delete Update"
          >
            <Trash2 size={18} />
          </button>
        )}

        <div className="flex items-center gap-2 mb-4">
          <div className="inline-flex items-center text-xs font-semibold text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
            <Clock size={13} className="mr-1.5 text-gray-400" />
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
            <span className="text-[11px] uppercase tracking-wider font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
              Preview
            </span>
          )}
        </div>
        
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 tracking-tight pr-8 break-words">
          {update.title}
        </h3>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap break-words text-[15px]">
            {update.content}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#FAFAFC] py-12 px-4 sm:px-6 lg:px-8 font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif] antialiased">
      
      {/* --- Delete Confirmation Modal --- */}
      {deleteModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[28px] p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-gray-100 animate-in zoom-in-95 duration-200 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Update?</h3>
            <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6">
              Are you sure you want to delete "<span className="font-semibold text-gray-700">{deleteModalTarget.title}</span>"? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteModalTarget(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={isDeleting}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 text-sm shadow-sm"
              >
                {isDeleting ? <Loader2 size={16} className="animate-spin" /> : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-8">
        
        {/* Navigation & Header */}
        <div className="space-y-6">
          <button
            onClick={() => navigate(-1)}
            className="group inline-flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors"
          >
            <span className="p-1.5 rounded-full bg-gray-100 group-hover:bg-gray-200 transition-colors">
              <ArrowLeft className="w-4 h-4" /> 
            </span>
            Back
          </button>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                <Megaphone size={24} strokeWidth={2.2} />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                  Updates
                </h1>
                <p className="text-sm font-medium text-gray-500 mt-0.5">
                  Product announcements and release notes.
                </p>
              </div>
            </div>

            {!isLoading && (
              <div className="bg-white border border-gray-100 px-4 py-2 rounded-2xl shadow-sm text-right">
                <div className="text-xl font-black text-gray-900 leading-none">{updates.length}</div>
                <div className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mt-1">Published</div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-2xl text-sm font-medium border border-red-100 flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Admin Post Form / Preview Wrapper */}
        {currentUser?.is_admin && (
          <div className="bg-white rounded-[24px] shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-gray-100 overflow-hidden transition-all duration-300">
            <div className="p-6 sm:p-8">
              {!isPreviewMode ? (
                <form onSubmit={handleReviewClick} className="space-y-4 animate-in fade-in">
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h2 className="text-lg font-bold text-gray-900">New Announcement</h2>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Title (e.g., Version 2.0 is Live)"
                      value={newUpdate.title}
                      onChange={(e) => setNewUpdate({ ...newUpdate, title: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50/50 rounded-xl border border-gray-200/80 focus:bg-white text-gray-900 font-semibold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none placeholder:text-gray-400 text-base"
                    />
                    <textarea
                      rows="4"
                      placeholder="What's new? Share the details..."
                      value={newUpdate.content}
                      onChange={(e) => setNewUpdate({ ...newUpdate, content: e.target.value })}
                      className="w-full px-4 py-3.5 bg-gray-50/50 rounded-xl border border-gray-200/80 focus:bg-white text-gray-900 font-medium focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none resize-none placeholder:text-gray-400 text-sm"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={!newUpdate.title.trim() || !newUpdate.content.trim()}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-black text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm text-sm"
                    >
                      Review Update
                      <SendIcon size={15} />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-gray-900">Preview Update</h2>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setIsPreviewMode(false)}
                      disabled={isPosting}
                      className="text-sm font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 size={15} /> Edit Draft
                    </button>
                  </div>

                  <UpdateCard update={newUpdate} isPreview={true} />

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => { setNewUpdate({ title: '', content: '' }); setIsPreviewMode(false); }}
                      disabled={isPosting}
                      className="px-5 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition-colors disabled:opacity-50 text-sm"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={handlePostUpdate}
                      disabled={isPosting}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all disabled:opacity-70 shadow-sm text-sm"
                    >
                      {isPosting ? (
                        <>
                          <Loader2 size={16} className="animate-spin" /> Publishing...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} /> Confirm & Publish
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
        <div className="space-y-8">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mb-3 text-blue-500" />
              <p className="font-medium text-sm">Fetching updates...</p>
            </div>
          ) : updates.length > 0 ? (
            <div className="space-y-8">
              
              {/* TODAY'S UPDATES */}
              {todayUpdates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Today</h2>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                  <div className="space-y-4">
                    {todayUpdates.map(update => (
                      <UpdateCard key={update.id || update._id} update={update} />
                    ))}
                  </div>
                </div>
              )}

              {/* EARLIER UPDATES */}
              {olderUpdates.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 px-1">
                    <div className="h-px bg-gray-200 flex-1"></div>
                    <h2 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Earlier</h2>
                    <div className="h-px bg-gray-200 flex-1"></div>
                  </div>
                  <div className="space-y-4">
                    {olderUpdates.map(update => (
                      <UpdateCard key={update.id || update._id} update={update} />
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="bg-white rounded-[24px] p-12 text-center border border-gray-100 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-gray-50 text-gray-400 flex items-center justify-center mx-auto mb-3">
                <Megaphone size={22} />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">No updates yet</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto font-medium">
                Check back later for product news and release announcements.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}