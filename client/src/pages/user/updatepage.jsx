import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Send,
  Clock,
  BellRing,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from "lucide-react";
import api from "../../utils/api";

export default function UpdatesPage() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [newUpdate, setNewUpdate] = useState({ title: "", content: "" });
  const [isPosting, setIsPosting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

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

          localStorage.setItem(
            "seenUpdatesCount",
            fetchedUpdates.length.toString(),
          );

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

  const handlePostUpdate = async (e) => {
    e.preventDefault();
    setError("");

    if (!newUpdate.title || !newUpdate.content) {
      setError("Please fill in both title and content.");
      return;
    }

    setIsPosting(true);

    try {
      await api.post("/user/updates", newUpdate);
      const res = await api.get("/user/updates");
      const newUpdatesList = res.data;

      setUpdates(newUpdatesList);
      setNewUpdate({ title: "", content: "" });

      // --- THE FIX: Mark as read after posting ---
      localStorage.setItem(
        "seenUpdatesCount",
        newUpdatesList.length.toString(),
      );
      window.dispatchEvent(new Event("updatesRead"));
    } catch (error) {
      console.error("Failed to post update:", error);
      setError(
        error.response?.data?.detail ||
          "There was an error posting your update. Make sure you are an Admin.",
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Go Back
          </button>

          <div className="rounded-3xl border border-white/30 bg-white/70 backdrop-blur-xl p-8 shadow-xl">
            <div className="flex justify-between items-start">
              <div className="flex gap-5">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                  <BellRing className="text-white" size={28} />
                </div>

                <div>
                  <h1 className="text-4xl font-bold tracking-tight text-zinc-900">
                    Latest Updates
                  </h1>

                  <p className="text-zinc-500 mt-2 max-w-xl">
                    Product improvements, announcements and release notes.
                  </p>
                </div>
              </div>

              <div className="hidden md:flex flex-col items-end">
                <span className="text-3xl font-bold">{updates.length}</span>

                <span className="text-sm text-zinc-500">Published</span>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Post Form */}
        {currentUser?.is_admin && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-4">
              <h2 className="text-white font-medium flex items-center gap-2">
                <Send size={18} className="text-blue-400" />
                Publish an Announcement
              </h2>
            </div>

            <form onSubmit={handlePostUpdate} className="p-6 space-y-5">
              {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm border border-red-100 flex items-start gap-2">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Update Title
                </label>
                <input
                  id="title"
                  type="text"
                  placeholder="e.g., Version 2.0 is Live!"
                  value={newUpdate.title}
                  onChange={(e) =>
                    setNewUpdate({ ...newUpdate, title: e.target.value })
                  }
                  disabled={isPosting}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white text-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none disabled:opacity-60"
                />
              </div>
              <div>
                <label
                  htmlFor="content"
                  className="block text-sm font-semibold text-gray-700 mb-2"
                >
                  Message Details
                </label>
                <textarea
                  id="content"
                  rows="3"
                  placeholder="What's new? Tell your users..."
                  value={newUpdate.content}
                  onChange={(e) =>
                    setNewUpdate({ ...newUpdate, content: e.target.value })
                  }
                  disabled={isPosting}
                  className="w-full px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 focus:bg-white text-zinc-950 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none disabled:opacity-60"
                />
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isPosting}
                  className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-70 disabled:hover:transform-none disabled:hover:shadow-none"
                >
                  {isPosting ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Publishing...
                    </>
                  ) : (
                    <>
                      Publish Update
                      <Send size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Public Feed Section */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
              <p className="text-gray-500 font-medium">Loading updates...</p>
            </div>
          ) : Array.isArray(updates) && updates.length > 0 ? (
            updates.map((update) => (
              <div
                key={update.id || update._id}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {update.title}
                </h3>
                <p className="text-gray-600 leading-relaxed mb-5 whitespace-pre-wrap">
                  {update.content}
                </p>
                <div className="flex items-center text-sm font-medium text-gray-400 bg-gray-50 inline-flex px-3 py-1.5 rounded-lg">
                  <Clock size={14} className="mr-2" />
                  {update.created_at
                    ? new Date(update.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Just now"}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white rounded-2xl border-2 border-dashed border-gray-200">
              <div className="bg-gray-50 p-4 rounded-full mb-4">
                <AlertCircle className="text-gray-400" size={32} />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                No updates yet
              </h3>
              <p className="text-gray-500 text-sm max-w-sm leading-relaxed">
                Check back later! We're always working on something new and
                exciting to share with you.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
