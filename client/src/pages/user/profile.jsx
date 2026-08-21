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
  Bell,
  Info,
  HelpCircle,
  Users2,
  BellOff,
  Camera,
  Edit2,
  Check,
  X,
  Newspaper,
  Send,
} from "lucide-react";
import api from "../../utils/api";
import MenuItem from "../../components/profile/MenuItem";
import AvatarPickerModal from "../../components/profile/AvatarPickerModal";

// Utility: Convert VAPID key for Push Manager
const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

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

  // --- Push Notifications & Updates States ---
  const [unreadUpdatesCount, setUnreadUpdatesCount] = useState(0);
  const [notificationStatus, setNotificationStatus] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);

  // Derived User ID
  const currentUserId = userInfo?._id || userInfo?.id;

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

  // Check Push Notification Subscription Status
  useEffect(() => {
    const checkSubscription = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (error) {
          console.error("Error checking push subscription:", error);
        }
      }
    };

    checkSubscription();
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

  const toggleNotifications = async () => {
    if (notificationStatus === "unsupported") {
      return alert("Browser does not support notifications.");
    }

    setTogglingPush(true);
    try {
      if (isSubscribed) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await subscription.unsubscribe();
          await api.post("/unsubscribe", { subscription, userId: currentUserId });
          setIsSubscribed(false);
        }
      } else {
        let permission = notificationStatus;
        if (permission !== "granted") {
          permission = await Notification.requestPermission();
          setNotificationStatus(permission);
        }

        if (permission === "granted") {
          const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          if (!vapidKey) {
            console.error("VAPID public key is missing from environment.");
            return;
          }

          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidKey),
          });

          await api.post("/subscribe", { subscription, userId: currentUserId });
          setIsSubscribed(true);
        }
      }
    } catch (error) {
      console.error("Notification toggle failed:", error);
    } finally {
      setTogglingPush(false);
    }
  };

  // Format local storage asset vs CDN URL
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
      <div className="min-h-screen bg-gray-50 pt-20 px-4 flex flex-col items-center">
        <div className="h-24 w-24 rounded-full bg-gray-200 animate-pulse mb-4" />
        <div className="h-6 w-32 bg-gray-200 animate-pulse rounded mb-2" />
        <div className="h-4 w-48 bg-gray-200 animate-pulse rounded mb-8" />
        <div className="w-full max-w-2xl bg-white rounded-2xl h-48 animate-pulse border border-gray-100" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 relative">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            to="/dashboard"
            aria-label="Back to Dashboard"
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
          >
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Profile</h1>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-6">
        {/* User Avatar & Info Header */}
        <div className="flex flex-col items-center text-center mb-10 mt-4">
          <button
            type="button"
            onClick={() => !isUploadingImage && setShowAvatarModal(true)}
            disabled={isUploadingImage}
            aria-label="Change profile picture"
            className="relative h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 mb-4 shadow-inner border-4 border-white cursor-pointer group overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {avatarUrl ? (
              <img
                src={getFormattedAvatarSrc(avatarUrl)}
                alt="Profile Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon size={40} />
            )}

            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white mb-1" size={20} />
              <span className="text-white text-[10px] font-semibold uppercase tracking-wider">Edit</span>
            </div>

            {isUploadingImage && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
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
                  className="px-3 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-semibold text-lg max-w-[200px]"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleUpdateName}
                  disabled={isUpdatingName}
                  className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {isUpdatingName ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingName(false);
                    setEditNameValue(userInfo?.username || "Student");
                  }}
                  className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 group cursor-pointer focus:outline-none focus:underline"
                onClick={() => setIsEditingName(true)}
              >
                <h2 className="text-2xl font-bold text-gray-900 capitalize tracking-tight">
                  {userInfo?.username || "User"}
                </h2>
                <Edit2 size={16} className="text-gray-400 group-hover:text-indigo-600 transition-colors" />
              </button>
            )}
          </div>

          <p className="text-gray-500">{userInfo?.email}</p>

          {userInfo?.created_at && (
            <div className="flex items-center gap-1.5 mt-4 px-4 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-full text-xs font-medium shadow-sm">
              <CalendarDays size={14} />
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
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">General</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <MenuItem icon={Users2} label="Squad" to="/squad" />
              <MenuItem icon={Newspaper} label="Updates" to="/update" badge={unreadUpdatesCount} />
              <MenuItem icon={HelpCircle} label="FAQ's" to="/faqs" />
              <MenuItem icon={Send} label="Telegram" to="/telegram" />
              <MenuItem icon={Info} label="About App" to="/about" />
            </div>
          </div>

          {/* Preferences Section */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preferences</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <MenuItem
                icon={notificationStatus === "denied" ? BellOff : Bell}
                label="Push Notifications"
                subLabel={
                  notificationStatus === "denied"
                    ? "Blocked in browser settings"
                    : "Receive updates on this device"
                }
                onClick={toggleNotifications}
                disabled={notificationStatus === "denied" || togglingPush}
                rightElement={
                  <div
                    role="switch"
                    aria-checked={isSubscribed}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isSubscribed ? "bg-indigo-600" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isSubscribed ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </div>
                }
              />
            </div>
          </div>

          {/* Account Section */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Account</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Logout Toggle */}
              {!showLogoutConfirm ? (
                <MenuItem icon={LogOut} label="Log Out" onClick={() => setShowLogoutConfirm(true)} />
              ) : (
                <div className="p-5 bg-gray-50 border-b border-gray-100">
                  <h3 className="font-bold text-gray-900 text-sm mb-4">Log out of your account?</h3>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black"
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
                    <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded">
                      Danger
                    </span>
                  }
                />
              ) : (
                <div className="p-5 bg-red-50 border-t border-red-100">
                  <div className="flex items-start gap-3 mb-5">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h3 className="font-bold text-red-700 text-sm">Are you absolutely sure?</h3>
                      <p className="text-xs text-red-600 mt-1">This action cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      disabled={deleteLoading}
                      className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold flex justify-center items-center hover:bg-red-700"
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