import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ArrowLeft, LogOut, Trash2, User as UserIcon, AlertTriangle, Loader2, CalendarDays, Bell } from "lucide-react";
import api from "../utils/api";

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export default function Profile() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

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

  const handleLogout = () => {
    localStorage.removeItem("token");
    navigate("/");
  };

  // Moved inside the component so we have access to userInfo
  const subscribeUser = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const publicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });

      // Send the subscription AND the user ID to your backend
      await api.post('/subscribe', {
        subscription: subscription,
        userId: userInfo.id // Assuming your user object has an 'id' or 'email'
      });
      
      alert("Notifications are now active!");
    } catch (error) {
      console.error("Failed to subscribe user:", error);
      alert("Failed to enable notifications.");
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert("This browser does not support desktop notifications");
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // Call subscribeUser ONLY if permission is granted
      await subscribeUser(); 
    } else {
      alert("Permission denied. You can enable them in your browser settings.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Navigation */}
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-all"
            >
              <ArrowLeft size={20} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900">Profile</h1>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 mt-8">
        {/* User Info Card */}
        <div className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm mb-6 flex flex-col items-center text-center">
          <div className="h-24 w-24 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-inner">
            <UserIcon size={40} />
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900 capitalize">
            {userInfo?.username || "User"}
          </h2>
          <p className="text-gray-500 mt-1">{userInfo?.email}</p>

          {/* Member Since Badge */}
          {userInfo?.created_at && (
            <div className="flex items-center gap-1.5 mt-4 px-3 py-1.5 bg-gray-50 border border-gray-100 text-gray-500 rounded-full text-sm font-medium">
              <CalendarDays size={14} />
              <span>
                Member since{" "}
                {new Date(userInfo.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            </div>
          )}
        </div>

        {/* Actions Section */}
        <div className="space-y-4">
          <button
            onClick={requestNotificationPermission}
            className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 transition-all text-left mb-4"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                <Bell size={20} />
              </div>
              <span className="font-semibold text-gray-800">
                Enable Notifications
              </span>
            </div>
          </button>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-2xl hover:border-gray-300 hover:shadow-sm transition-all text-left"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 text-gray-700 rounded-lg">
                <LogOut size={20} />
              </div>
              <span className="font-semibold text-gray-800">Log Out</span>
            </div>
          </button>

          {/* Delete Account Section */}
          <div className="p-4 bg-red-50 border border-red-100 rounded-2xl mt-8">
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full flex items-center gap-3 text-red-600 hover:text-red-700 transition-colors"
              >
                <div className="p-2 bg-red-100 rounded-lg">
                  <Trash2 size={20} />
                </div>
                <div className="text-left flex-1">
                  <span className="font-bold block">Delete Account</span>
                  <span className="text-sm text-red-500/80">
                    Permanently remove all your data
                  </span>
                </div>
              </button>
            ) : (
              <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-3 mb-4">
                  <AlertTriangle
                    className="text-red-500 shrink-0 mt-0.5"
                    size={20}
                  />
                  <div>
                    <h3 className="font-bold text-red-700">
                      Are you absolutely sure?
                    </h3>
                    <p className="text-sm text-red-600 mt-1">
                      This action cannot be undone. All your reminders and data
                      will be permanently deleted.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors"
                    disabled={deleteLoading}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex justify-center items-center"
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      "Yes, Delete My Account"
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
