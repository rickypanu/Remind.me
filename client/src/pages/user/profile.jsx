import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft,
  LogOut,
  Trash2,
  User as UserIcon,
  AlertTriangle,
  Loader2,
  CalendarDays,
  Info,
  HelpCircle,
  Camera,
  Edit2,
  Check,
  X,
  Newspaper,
  Send,
  Shield,
} from "lucide-react";
import api from "../../utils/api";
import MenuItem from "../components/MenuItems";
import AvatarPickerModal from "../components/AvatarPickerModal";

export default function Profile() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // --- Core State ---
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- Modals & Confirmation States ---
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // --- Profile Editing States ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // --- Avatar States ---
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  // --- Updates State ---
  const [unreadUpdatesCount, setUnreadUpdatesCount] = useState(0);

  // --- Data Fetching Effects ---

  // Fetch User Info
  useEffect(() => {
    let isMounted = true;

    const fetchUser = async () => {
      try {
        const response = await api.get("/user/me");
        if (!isMounted) return;

        const userData = response.data;
        setUserInfo(userData);
        setEditNameValue(userData?.username || "Student");
        if (userData?.avatar_url) {
          setAvatarUrl(userData.avatar_url);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        if (error.response?.status === 401) {
          handleLogout();
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchUser();
    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch Unread Updates Counter
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.get("/user/updates");
        const totalUpdates = res.data?.length || 0;
        const lastSeenCount = parseInt(localStorage.getItem("seenUpdatesCount") || "0", 10);
        
        if (totalUpdates > lastSeenCount) {
          setUnreadUpdatesCount(totalUpdates - lastSeenCount);
        }
      } catch (error) {
        console.error("Failed to fetch updates count:", error);
      }
    };

    fetchUnreadCount();

    const handleUpdatesRead = () => setUnreadUpdatesCount(0);
    window.addEventListener("updatesRead", handleUpdatesRead);

    return () => {
      window.removeEventListener("updatesRead", handleUpdatesRead);
    };
  }, []);

  // --- Action Handlers ---

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await api.delete("/user/me");
      handleLogout();
    } catch (error) {
      console.error("Failed to delete account:", error);
      alert("Failed to delete account. Please try again later.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleUpdateName = async () => {
    const trimmedName = editNameValue.trim();
    if (!trimmedName || trimmedName === userInfo?.username) {
      setIsEditingName(false);
      return;
    }

    setIsUpdatingName(true);
    try {
      await api.patch("/user/me", { username: trimmedName });
      setUserInfo((prev) => (prev ? { ...prev, username: trimmedName } : prev));
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update name:", error);
      alert("Failed to update name. Please try again.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setShowAvatarModal(false);
    const tempPreviewUrl = URL.createObjectURL(file);
    setAvatarUrl(tempPreviewUrl);
    setIsUploadingImage(true);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await api.post("/user/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.data?.avatar_url) {
        setAvatarUrl(response.data.avatar_url);
        setUserInfo((prev) => (prev ? { ...prev, avatar_url: response.data.avatar_url } : prev));
      }
    } catch (error) {
      console.error("Failed to upload avatar:", error);
      setAvatarUrl(userInfo?.avatar_url || null);
      alert("Failed to upload image.");
    } finally {
      URL.revokeObjectURL(tempPreviewUrl);
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleIllustrationSelect = async (illustrationUrl) => {
    setShowAvatarModal(false);
    const previousUrl = avatarUrl;
    setAvatarUrl(illustrationUrl);
    setIsUploadingImage(true);

    try {
      await api.patch("/user/me", { avatar_url: illustrationUrl });
      setUserInfo((prev) => (prev ? { ...prev, avatar_url: illustrationUrl } : prev));
    } catch (error) {
      console.error("Failed to update avatar illustration:", error);
      setAvatarUrl(previousUrl);
      alert("Failed to set avatar.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const getFormattedAvatarSrc = (url) => {
    if (!url) return null;
    if (url.startsWith("/uploads")) {
      const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";
      return `${baseUrl}${url}`;
    }
    return url;
  };

  // --- Render Loading Skeleton ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFC] pt-20 px-4 flex flex-col items-center">
        <div className="h-24 w-24 rounded-full bg-gray-100 animate-pulse mb-4" />
        <div className="h-6 w-32 bg-gray-100 animate-pulse rounded-lg mb-2" />
        <div className="h-4 w-48 bg-gray-100 animate-pulse rounded-lg mb-8" />
        <div className="w-full max-w-xl bg-white rounded-[2rem] h-48 animate-pulse border border-gray-100 shadow-sm" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFC] pb-20 relative antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      
      {/* iOS-Style Sticky Header */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 px-4 py-3">
        <div className="max-w-xl mx-auto flex items-center gap-3 relative">
          <Link
            to="/dashboard"
            aria-label="Back to Dashboard"
            className="absolute left-0 p-2 -ml-2 text-blue-500 hover:opacity-70 transition-opacity flex items-center gap-1"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </Link>
          <h1 className="w-full text-center text-[17px] font-semibold text-gray-900 tracking-tight">
            Profile
          </h1>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-xl mx-auto px-4 mt-8">
        
        {/* User Avatar & Info Header */}
        <div className="flex flex-col items-center text-center mb-10">
          <button
            type="button"
            onClick={() => !isUploadingImage && setShowAvatarModal(true)}
            disabled={isUploadingImage}
            aria-label="Change profile picture"
            className="relative h-24 w-24 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 mb-4 shadow-sm border-2 border-white cursor-pointer group overflow-hidden focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {avatarUrl ? (
              <img
                src={getFormattedAvatarSrc(avatarUrl)}
                alt="Profile Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon size={36} strokeWidth={2} />
            )}

            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white mb-0.5" size={18} strokeWidth={2} />
              <span className="text-white text-[10px] font-semibold uppercase tracking-wider">Edit</span>
            </div>

            {isUploadingImage && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="animate-spin text-blue-500" size={24} />
              </div>
            )}
          </button>

          {/* Hidden File Input */}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Editable Username */}
          <div className="flex items-center justify-center h-10 mb-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUpdateName()}
                  className="px-3 py-1.5 bg-gray-50 border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-gray-900 font-semibold text-lg max-w-[200px]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleUpdateName}
                  disabled={isUpdatingName}
                  className="p-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors shadow-sm"
                >
                  {isUpdatingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} strokeWidth={2.5} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setEditNameValue(userInfo?.username || "Student");
                  }}
                  className="p-2 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 group cursor-pointer focus:outline-none"
                onClick={() => setIsEditingName(true)}
              >
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">
                  {userInfo?.username || "User"}
                </h2>
                <Edit2 size={15} className="text-gray-400 group-hover:text-blue-500 transition-colors" />
              </button>
            )}
          </div>

          <p className="text-gray-500 font-medium text-sm">{userInfo?.email}</p>

          {userInfo?.created_at && (
            <div className="flex items-center gap-1.5 mt-3 px-3.5 py-1 bg-white border border-gray-100 text-gray-400 rounded-full text-xs font-semibold shadow-sm">
              <CalendarDays size={13} strokeWidth={2} />
              <span>
                Joined{" "}
                {new Date(userInfo.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Action Menu Groups */}
        <div className="space-y-6">
          {/* General Section */}
          <div>
            <h3 className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">General</h3>
            <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              <MenuItem icon={Newspaper} label="Updates" to="/updates" badge={unreadUpdatesCount} />
              <MenuItem icon={HelpCircle} label="FAQ's" to="/faqs" />
              <MenuItem icon={Send} label="Connect Telegram" to="/telegram-setup" />
              <MenuItem icon={Shield} label="Legal & Privacy" to="/terms" />
              <MenuItem icon={Info} label="About App" to="/about" />
            </div>
          </div>

          {/* Account Section */}
          <div>
            <h3 className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Account</h3>
            <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
              
              {/* Logout Toggle */}
              {!showLogoutConfirm ? (
                <MenuItem icon={LogOut} label="Log Out" onClick={() => setShowLogoutConfirm(true)} />
              ) : (
                <div className="p-6 bg-gray-50/50 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm mb-3">Log out of your account?</h3>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex-1 py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors shadow-sm"
                    >
                      Yes, Log Out
                    </button>
                  </div>
                </div>
              )}

              {/* Delete Account Toggle */}
              {!showDeleteConfirm ? (
                <MenuItem
                  icon={Trash2}
                  label="Delete Account"
                  danger
                  onClick={() => setShowDeleteConfirm(true)}
                  rightElement={
                    <span className="text-[11px] font-bold text-red-500 bg-red-50 px-2.5 py-0.5 rounded-md">
                      Danger
                    </span>
                  }
                />
              ) : (
                <div className="p-6 bg-red-50/50 border-t border-red-100">
                  <div className="flex items-start gap-3 mb-5">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h3 className="font-bold text-red-700 text-sm">Are you absolutely sure?</h3>
                      <p className="text-xs text-red-600 font-medium mt-0.5">This action cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="flex-1 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold flex justify-center items-center hover:bg-red-700 transition-colors shadow-sm disabled:opacity-70"
                    >
                      {deleteLoading ? <Loader2 size={16} className="animate-spin" /> : "Delete My Data"}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </main>

      {/* Avatar Selector Modal */}
      <AvatarPickerModal
        isOpen={showAvatarModal}
        onClose={() => setShowAvatarModal(false)}
        onUploadClick={() => fileInputRef.current?.click()}
        onSelectIllustration={handleIllustrationSelect}
      />
    </div>
  );
}