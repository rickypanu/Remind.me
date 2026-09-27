import React, { useState, useEffect } from 'react';
import { Bell, BellOff,BellCheckIcon, LayoutDashboard, Plus, CircleUser, Check, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Required helper to convert the VAPID key string into a format the browser accepts
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const Header = () => {
  const isLoggedIn = !!localStorage.getItem("token");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [userId, setUserId] = useState(null);
  const [pushStatus, setPushStatus] = useState('idle'); // 'idle', 'loading', 'subscribed'

  useEffect(() => {
    // 1. Function to check if the browser already has an active push subscription
    const checkLocalSubscription = async () => {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const registration = await navigator.serviceWorker.ready;
          const existingSubscription = await registration.pushManager.getSubscription();
          
          if (existingSubscription) {
            console.log("Browser is already subscribed to push notifications.");
            setPushStatus('subscribed');
          }
        } catch (error) {
          console.error("Error checking local push subscription:", error);
        }
      }
    };

    if (isLoggedIn) {
      // 2. Fetch user data
      api.get("/user/me")
        .then(({ data }) => {
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
          if (data?._id || data?.id) setUserId(data._id || data.id);
          
          // Fallback check: if backend says we are subscribed
          if (data?.push_subscription) setPushStatus('subscribed');
        })
        .catch((error) => console.error("Failed to fetch user data for header", error));

      // 3. Run the local browser check on mount
      checkLocalSubscription();
    }
  }, [isLoggedIn]);

  const getAvatarSrc = () => avatarUrl?.startsWith("/uploads") 
    ? `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "")}${avatarUrl}` 
    : avatarUrl;

  const handleSubscribe = async () => {
    if (pushStatus === 'subscribed' || !userId) return;
    if (!PUBLIC_VAPID_KEY) {
      console.error("VAPID key is missing! Check your .env file.");
      return;
    }

    try {
      setPushStatus('loading');
      
      let registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
      }
      await navigator.serviceWorker.ready;
      
      const convertedVapidKey = urlBase64ToUint8Array(PUBLIC_VAPID_KEY);
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedVapidKey
      });

      await api.post('/webpush/subscribe', {
        subscription: subscription,
        userId: userId
      });

      setPushStatus('subscribed');

    } catch (error) {
      console.error("Failed to subscribe to push notifications:", error);
      setPushStatus('idle'); 
    }
  };

  const handleUnsubscribe = async () => {
    if (!userId) return;

    try {
      setPushStatus('loading');
      
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // 1. Tell the browser to revoke the push subscription locally
        await subscription.unsubscribe();
      }

      // 2. Tell your FastAPI backend to remove it from the database
      await api.delete(`/webpush/unsubscribe/${userId}`);

      console.log("Successfully unsubscribed!");
      setPushStatus('idle'); // Resets the button back to "Enable Alerts"

    } catch (error) {
      console.error("Failed to unsubscribe:", error);
      setPushStatus('subscribed'); // Revert state if the API call fails
    }
  };

  const toggleSubscription = () => {
    if (pushStatus === 'subscribed') {
      handleUnsubscribe();
    } else if (pushStatus === 'idle') {
      handleSubscribe();
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 antialiased shadow-sm font-sans">
      <div className={`flex items-center justify-between h-16 mx-auto w-full transition-all duration-300 ${
        isLoggedIn 
          ? "max-w-6xl px-4 sm:px-6 lg:px-8" 
          : "max-w-7xl px-4 sm:px-6 md:px-12 lg:px-20"
      }`}>
        
        {/* Logo Section */}
        <Link 
          to={isLoggedIn ? "/dashboard" : "/"} 
          className="flex items-center gap-2 sm:gap-3 group select-none active:scale-95 transition-transform outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 transition-all group-hover:shadow-blue-500/40 group-hover:-translate-y-0.5">
            <LayoutDashboard size={20} strokeWidth={2.5} />
          </div>
          {/* Removed the 'hidden xs:block' so it always shows */}
          <span className="text-[18px] sm:text-[19px] font-extrabold tracking-tight text-gray-900">
            Remind<span className="text-blue-600">Me</span>
          </span>
        </Link>
      
        {/* Action Buttons Section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!isLoggedIn ? (
            <>
              <Link to="/login" className="text-gray-600 hover:text-gray-900 px-3 py-2 sm:px-4 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors">
                Log in
              </Link>
              <Link to="/register" className="bg-gray-900 hover:bg-black text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-md hover:shadow-lg whitespace-nowrap">
                Get Started
              </Link>
            </>
          ) : (
            <>
              {/* Push Subscription Button */}
              <button
                onClick={toggleSubscription}
                disabled={pushStatus === 'loading'}
                className={`group relative flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full text-sm font-semibold active:scale-95 transition-all duration-200 shadow-sm ${
                  pushStatus === 'subscribed'
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-600 border border-emerald-200/50 hover:border-rose-200/50'
                    : pushStatus === 'loading' 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900'
                }`}
                aria-label={pushStatus === 'subscribed' ? 'Unsubscribe from alerts' : 'Enable alerts'}
              >
                {/* Dynamic Icons */}
                {pushStatus === 'loading' && <Loader2 size={18} strokeWidth={2.5} className="animate-spin text-blue-500" />}
                
                {pushStatus === 'subscribed' && (
                  <>
                    <BellCheckIcon size={18} strokeWidth={2.5} className="block group-hover:hidden text-emerald-600" />
                    <BellOff size={18} strokeWidth={2.5} className="hidden group-hover:block text-rose-500" />
                  </>
                )}
                
                {pushStatus === 'idle' && (
                  <Bell size={18} strokeWidth={2.5} className="text-gray-500 group-hover:text-blue-500 transition-colors" />
                )}
                
                {/* Dynamic Text (Hidden on small screens, visible on SM and up) */}
                <span className="hidden sm:block w-[100px] text-center">
                  {pushStatus === 'loading' ? (
                    'Updating...'
                  ) : pushStatus === 'subscribed' ? (
                    <>
                      <span className="block group-hover:hidden">Subscribed</span>
                      <span className="hidden group-hover:block">Unsubscribe</span>
                    </>
                  ) : (
                    'Enable Alerts'
                  )}
                </span>
              </button>

              {/* New Reminder Button */}
              <Link
                to="/create-task"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-9 h-9 sm:w-auto sm:h-auto sm:px-4 sm:py-2.5 rounded-full text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all duration-200"
                aria-label="New Reminder"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span className="hidden md:block">New Reminder</span>
              </Link>

              <div className="h-6 w-px bg-gray-200 mx-0.5 sm:mx-1"></div>

              {/* Profile Avatar */}
              <Link
                to="/profile"
                className="flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex-shrink-0"
              >
                {avatarUrl ? (
                  <img 
                    src={getAvatarSrc()} 
                    alt="User Profile" 
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-gray-100 shadow-sm hover:ring-blue-100 transition-all"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 ring-1 ring-gray-200 hover:bg-gray-200 transition-all">
                    <CircleUser size={22} strokeWidth={2} />
                  </div>
                )}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Header;