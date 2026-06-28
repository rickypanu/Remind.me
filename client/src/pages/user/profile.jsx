import React, { useState, useEffect } from "react";
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
  BellOff
} from "lucide-react";
import api from "../../utils/api";

const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

// Reusable UI Component for Menu Items
const MenuItem = ({ icon: Icon, label, onClick, to, rightElement, danger, disabled, subLabel }) => {
  const content = (
    <div className={`flex items-center justify-between p-4 w-full text-left transition-colors ${disabled ? 'opacity-60 bg-gray-50' : 'bg-white hover:bg-gray-50 active:bg-gray-100'}`}>
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-xl ${danger ? 'bg-red-50 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
          <Icon size={20} />
        </div>
        <div className="flex flex-col">
          <span className={`font-medium ${danger ? 'text-red-600' : 'text-gray-900'}`}>
            {label}
          </span>
          {subLabel && <span className="text-xs text-gray-500 mt-0.5">{subLabel}</span>}
        </div>
      </div>
      {rightElement || (!onClick && !disabled && <ChevronRight size={18} className="text-gray-400" />)}
    </div>
  );

  if (to) {
    return <Link to={to} className="block border-b border-gray-100 last:border-0">{content}</Link>;
  }
  return (
    <button onClick={onClick} disabled={disabled} className="block w-full border-b border-gray-100 last:border-0">
      {content}
    </button>
  );
};

export default function Profile() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
      } catch (error) {
        console.error("Failed to fetch user data", error);
        if (error.response?.status === 401) handleLogout();
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

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

  const toggleNotifications = async () => {
    if (notificationStatus === "unsupported") {
      alert("This browser does not support desktop notifications");
      return;
    }

    setTogglingPush(true);
    
    try {
      if (isSubscribed) {
        // Unsubscribe Flow
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
        // Subscribe Flow
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
          alert("Permission denied. You can enable them in your browser settings.");
        }
      }
    } catch (error) {
      console.error("Notification toggle failed:", error);
      alert("Failed to update notification settings.");
    } finally {
      setTogglingPush(false);
    }
  };

  // Modern Skeleton Loader
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
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link
            to="/dashboard"
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
          >
            <ArrowLeft size={22} />
          </Link>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Profile</h1>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-6">
        
        {/* User Info Header */}
        <div className="flex flex-col items-center text-center mb-10 mt-4">
          <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 mb-4 shadow-inner border-4 border-white">
            <UserIcon size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 capitalize tracking-tight">
            {userInfo?.username || "User"}
          </h2>
          <p className="text-gray-500 mt-1">{userInfo?.email}</p>

          {userInfo?.created_at && (
            <div className="flex items-center gap-1.5 mt-4 px-4 py-1.5 bg-white border border-gray-200 text-gray-500 rounded-full text-xs font-medium shadow-sm">
              <CalendarDays size={14} />
              <span>
                Joined {new Date(userInfo.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-6">
          
          {/* Section 1: General */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">General</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <MenuItem icon={Users2} label="Squad" to="/squad" />
              <MenuItem icon={HelpCircle} label="FAQ's" to="/faqs" />
              <MenuItem icon={Info} label="About App" to="/about" />
            </div>
          </div>

          {/* Section 2: Preferences */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Preferences</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <MenuItem 
                icon={notificationStatus === "denied" ? BellOff : Bell} 
                label="Push Notifications"
                subLabel={notificationStatus === "denied" ? "Blocked in browser settings" : "Receive updates on this device"}
                onClick={toggleNotifications}
                disabled={notificationStatus === "denied" || togglingPush}
                rightElement={
                  <button 
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isSubscribed ? 'bg-indigo-600' : 'bg-gray-200'} ${notificationStatus === 'denied' ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                }
              />
            </div>
          </div>

          {/* Section 3: Account */}
          <div>
            <h3 className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Account</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Log Out UI */}
              {!showLogoutConfirm ? (
                <MenuItem 
                  icon={LogOut} 
                  label="Log Out" 
                  onClick={() => setShowLogoutConfirm(true)} 
                />
              ) : (
                <div className="p-5 bg-gray-50 border-b border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="mb-4">
                    <h3 className="font-bold text-gray-900 text-sm">Log out of your account?</h3>
                    <p className="text-xs text-gray-500 mt-1">You will need to sign back in to access your data.</p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-100 transition-colors shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleLogout}
                      className="flex-1 py-2 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors shadow-sm"
                    >
                      Yes, Log Out
                    </button>
                  </div>
                </div>
              )}
              
              {/* Delete Account UI */}
              {!showDeleteConfirm ? (
                <MenuItem 
                  icon={Trash2} 
                  label="Delete Account" 
                  danger 
                  onClick={() => setShowDeleteConfirm(true)} 
                  rightElement={<span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-1 rounded">Danger</span>}
                />
              ) : (
                <div className="p-5 bg-red-50 border-t border-red-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex items-start gap-3 mb-5">
                    <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <h3 className="font-bold text-red-700 text-sm">Are you absolutely sure?</h3>
                      <p className="text-xs text-red-600 mt-1 leading-relaxed">
                        This action cannot be undone. All your reminders and data will be permanently deleted from our servers.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors shadow-sm"
                      disabled={deleteLoading}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteAccount}
                      className="flex-1 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm flex justify-center items-center"
                      disabled={deleteLoading}
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
    </div>
  );
}