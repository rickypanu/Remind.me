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
  ChevronRight,
  BellOff,
  Camera,
  Edit2,
  Check,
  X,
  UploadCloud,
  Image as ImageIcon,
} from "lucide-react";
import api from "../../utils/api";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

// Reusable UI Component for Menu Items
const MenuItem = ({
  icon: Icon,
  label,
  onClick,
  to,
  rightElement,
  danger,
  disabled,
  subLabel,
}) => {
  const content = (
    <div
      className={`flex items-center justify-between p-4 w-full text-left transition-colors ${disabled ? "opacity-60 bg-gray-50" : "bg-white hover:bg-gray-50 active:bg-gray-100"}`}
    >
      <div className="flex items-center gap-4">
        <div
          className={`p-2.5 rounded-xl ${danger ? "bg-red-50 text-red-600" : "bg-indigo-50 text-indigo-600"}`}
        >
          <Icon size={20} />
        </div>
        <div className="flex flex-col">
          <span
            className={`font-medium ${danger ? "text-red-600" : "text-gray-900"}`}
          >
            {label}
          </span>
          {subLabel && (
            <span className="text-xs text-gray-500 mt-0.5">{subLabel}</span>
          )}
        </div>
      </div>
      {rightElement ||
        (!onClick && !disabled && (
          <ChevronRight size={18} className="text-gray-400" />
        ))}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block border-b border-gray-100 last:border-0">
        {content}
      </Link>
    );
  }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="block w-full border-b border-gray-100 last:border-0"
    >
      {content}
    </button>
  );
};

// --- Mock Illustrations for the Google-style Picker ---
// We use the free DiceBear API to generate beautiful vector avatars instantly.
const ILLUSTRATION_CATEGORIES = {
  "Tech Bots": [
    "https://api.dicebear.com/7.x/bottts/svg?seed=Felix&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Oliver&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Caleb&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/bottts/svg?seed=Zoey&backgroundColor=ffd5dc",
  ],
  Animals: [
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Milo&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Bella&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Lucy&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/fun-emoji/svg?seed=Max&backgroundColor=ffd5dc",
  ],
  Adventurers: [
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Jack&backgroundColor=b6e3f4",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Jasmine&backgroundColor=c0aede",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=George&backgroundColor=ffdfbf",
    "https://api.dicebear.com/7.x/adventurer/svg?seed=Mia&backgroundColor=ffd5dc",
  ],
};

export default function Profile() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // --- Profile Name Editing State ---
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [isUpdatingName, setIsUpdatingName] = useState(false);

  // --- Image & Illustration Picker State ---
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [activeTab, setActiveTab] = useState("Tech Bots");

  const [notificationStatus, setNotificationStatus] = useState(
    "Notification" in window ? Notification.permission : "unsupported",
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [togglingPush, setTogglingPush] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await api.get("/user/me");
        setUserInfo(response.data);
        setEditNameValue(response.data.username || "Student");
        if (response.data.avatar_url) {
          setAvatarUrl(response.data.avatar_url);
        }
      } catch (error) {
        console.error("Failed to fetch user data", error);
        if (error.response?.status === 401) handleLogout();
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Check Notifications
  useEffect(() => {
    const checkSubscription = async () => {
      if ("serviceWorker" in navigator) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.getSubscription();
          setIsSubscribed(!!subscription);
        } catch (error) {
          console.error("Error checking subscription:", error);
        }
      }
    };
    checkSubscription();
  }, []);

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
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- 1. Handle Updating Username ---
  const handleUpdateName = async () => {
    if (!editNameValue.trim() || editNameValue === userInfo.username) {
      setIsEditingName(false);
      return;
    }

    setIsUpdatingName(true);
    try {
      await api.patch("/user/me", { username: editNameValue });
      setUserInfo({ ...userInfo, username: editNameValue });
      setIsEditingName(false);
    } catch (error) {
      console.error("Failed to update name:", error);
      alert("Failed to update name. Please try again.");
    } finally {
      setIsUpdatingName(false);
    }
  };

  // --- 2. Handle File Upload (Device) ---
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setShowAvatarModal(false); // Close modal when file is picked
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    setIsUploadingImage(true);

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const response = await api.post("/user/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (response.data.avatar_url) setAvatarUrl(response.data.avatar_url);
    } catch (error) {
      console.error("Failed to upload image:", error);
      setAvatarUrl(userInfo?.avatar_url || null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // --- 3. Handle Illustration Selection ---
  const handleIllustrationSelect = async (illustrationUrl) => {
    setShowAvatarModal(false);
    setAvatarUrl(illustrationUrl);
    setIsUploadingImage(true);

    try {
      // Send the string path directly to the PATCH /me route
      await api.patch("/user/me", { avatar_url: illustrationUrl });
    } catch (error) {
      console.error("Failed to save illustration:", error);
      setAvatarUrl(userInfo?.avatar_url || null);
    } finally {
      setIsUploadingImage(false);
    }
  };

  // --- Push Notifications Toggle ---
  const toggleNotifications = async () => {
    if (notificationStatus === "unsupported") {
      alert("This browser does not support desktop notifications");
      return;
    }
    setTogglingPush(true);
    try {
      if (isSubscribed) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
          await api.post("/unsubscribe", {
            subscription: subscription,
            userId: userInfo.id,
          });
          setIsSubscribed(false);
        }
      } else {
        let permission = notificationStatus;
        if (permission !== "granted") {
          permission = await Notification.requestPermission();
          setNotificationStatus(permission);
        }
        if (permission === "granted") {
          const registration = await navigator.serviceWorker.ready;
          const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
          await api.post("/subscribe", {
            subscription: subscription,
            userId: userInfo.id,
          });
          setIsSubscribed(true);
        } else {
          alert("Permission denied.");
        }
      }
    } catch (error) {
      console.error("Notification toggle failed:", error);
    } finally {
      setTogglingPush(false);
    }
  };

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
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
          >
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">
            Profile
          </h1>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-6">
        {/* User Info Header */}
        <div className="flex flex-col items-center text-center mb-10 mt-4">
          {/* Avatar Section */}
          <div
            onClick={() => !isUploadingImage && setShowAvatarModal(true)}
            className="relative h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 mb-4 shadow-inner border-4 border-white cursor-pointer group overflow-hidden"
          >
            {avatarUrl ? (
              <img
                src={
                  avatarUrl.startsWith("/uploads")
                    ? `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "")}${avatarUrl}`
                    : avatarUrl
                }
                alt="Profile Avatar"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserIcon size={40} />
            )}

            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="text-white mb-1" size={20} />
              <span className="text-white text-[10px] font-semibold uppercase tracking-wider">
                Edit
              </span>
            </div>

            {isUploadingImage && (
              <div className="absolute inset-0 bg-white/70 flex items-center justify-center backdrop-blur-sm">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
              </div>
            )}
          </div>

          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Name Display / Edit Section */}
          <div className="flex items-center justify-center h-10 mb-1">
            {isEditingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="px-3 py-1.5 border border-indigo-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-900 font-semibold text-lg max-w-[200px]"
                  autoFocus
                />
                <button
                  onClick={handleUpdateName}
                  disabled={isUpdatingName}
                  className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {isUpdatingName ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Check size={16} />
                  )}
                </button>
                <button
                  onClick={() => setIsEditingName(false)}
                  className="p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div
                className="flex items-center gap-2 group cursor-pointer"
                onClick={() => setIsEditingName(true)}
              >
                <h2 className="text-2xl font-bold text-gray-900 capitalize tracking-tight">
                  {userInfo?.username || "User"}
                </h2>
                <Edit2
                  size={16}
                  className="text-gray-400 group-hover:text-indigo-600 transition-colors"
                />
              </div>
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

        <div className="space-y-6">
          {/* Section 1: General */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              General
            </h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <MenuItem icon={Users2} label="Squad" to="/squad" />
              <MenuItem icon={HelpCircle} label="FAQ's" to="/faqs" />
              <MenuItem icon={Info} label="About App" to="/about" />
            </div>
          </div>

          {/* Section 2: Preferences */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Preferences
            </h3>
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
                  <button
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isSubscribed ? "bg-indigo-600" : "bg-gray-200"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSubscribed ? "translate-x-6" : "translate-x-1"}`}
                    />
                  </button>
                }
              />
            </div>
          </div>

          {/* Section 3: Account */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Account
            </h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {!showLogoutConfirm ? (
                <MenuItem
                  icon={LogOut}
                  label="Log Out"
                  onClick={() => setShowLogoutConfirm(true)}
                />
              ) : (
                <div className="p-5 bg-gray-50 border-b border-gray-100">
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-900 text-sm">
                      Log out of your account?
                    </h3>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold"
                    >
                      Yes, Log Out
                    </button>
                  </div>
                </div>
              )}

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
                    <AlertTriangle
                      className="text-red-500 shrink-0 mt-0.5"
                      size={20}
                    />
                    <div>
                      <h3 className="font-bold text-red-700 text-sm">
                        Are you absolutely sure?
                      </h3>
                      <p className="text-xs text-red-600 mt-1">
                        This action cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 bg-white border text-gray-700 rounded-xl text-sm font-semibold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold flex justify-center items-center"
                    >
                      {deleteLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        "Delete My Data"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* --- AVATAR PICKER MODAL (Google Style) --- */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">
                Choose Profile Picture
              </h3>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-5">
              {/* Device Upload Option */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-4 mb-6 border-2 border-dashed border-indigo-200 rounded-2xl bg-indigo-50/50 hover:bg-indigo-50 text-indigo-600 font-semibold transition-colors"
              >
                <UploadCloud size={24} />
                Upload from Device
              </button>

              <div className="flex items-center gap-4 mb-4">
                <div className="h-px bg-gray-200 flex-1"></div>
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
                  Or choose illustration
                </span>
                <div className="h-px bg-gray-200 flex-1"></div>
              </div>

              {/* Illustration Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {Object.keys(ILLUSTRATION_CATEGORIES).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Grid of Illustrations */}
              <div className="grid grid-cols-4 gap-3 mt-4">
                {ILLUSTRATION_CATEGORIES[activeTab].map((url, index) => (
                  <div
                    key={index}
                    onClick={() => handleIllustrationSelect(url)}
                    className="aspect-square rounded-2xl bg-gray-50 border-2 border-transparent hover:border-indigo-500 cursor-pointer overflow-hidden transition-all hover:scale-105 active:scale-95"
                  >
                    <img
                      src={url}
                      alt="avatar option"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
