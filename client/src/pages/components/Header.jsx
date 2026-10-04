import React, { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, BellRing, LayoutDashboard, Plus, CircleUser, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../utils/api';

const PUBLIC_VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Converts the VAPID key string into a format the browser accepts
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// The service worker is registered by vite-plugin-pwa (registerSW.js).
// `ready` never resolves if no service worker is registered (e.g. `vite dev`),
// so we race it against a timeout instead of hanging on "Updating...".
function getActiveRegistration(timeoutMs = 8000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            'Service worker is not active. Test push on a production build (npm run build && npm run preview) or the deployed site.'
          )
        ),
      timeoutMs
    );
  });
  return Promise.race([navigator.serviceWorker.ready, timeout]).finally(() => clearTimeout(timer));
}

const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const Header = () => {
  const isLoggedIn = !!localStorage.getItem('token');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [userId, setUserId] = useState(null);
  const [pushStatus, setPushStatus] = useState('idle'); // 'idle' | 'loading' | 'subscribed'
  const [pushError, setPushError] = useState('');
  const errorTimerRef = useRef(null);

  // Auto-dismiss the error bubble after a few seconds
  useEffect(() => {
    if (!pushError) return;
    errorTimerRef.current = setTimeout(() => setPushError(''), 6000);
    return () => clearTimeout(errorTimerRef.current);
  }, [pushError]);

  useEffect(() => {
    if (!isLoggedIn) return;

    // Subscription state is per DEVICE, so the browser is the source of truth.
    // If this browser is already subscribed, re-send it to the backend
    // (idempotent via $addToSet) so a lost DB record heals itself.
    const syncLocalSubscription = async (uid) => {
      if (!pushSupported()) return;
      try {
        const registration = await getActiveRegistration();
        const existing = await registration.pushManager.getSubscription();
        if (existing) {
          setPushStatus('subscribed');
          if (uid) {
            await api.post('/webpush/subscribe', {
              subscription: existing.toJSON(),
              userId: uid,
            });
          }
        }
      } catch (error) {
        console.error('Error checking local push subscription:', error);
      }
    };

    api
      .get('/user/me')
      .then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        const uid = data?._id || data?.id;
        if (uid) setUserId(uid);
        syncLocalSubscription(uid);
      })
      .catch((error) => console.error('Failed to fetch user data for header', error));
  }, [isLoggedIn]);

  const getAvatarSrc = () =>
    avatarUrl?.startsWith('/uploads')
      ? `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')}${avatarUrl}`
      : avatarUrl;

  const handleSubscribe = async () => {
    if (pushStatus === 'subscribed' || !userId) return;
    setPushError('');

    if (!pushSupported()) {
      setPushError('Push is not supported here. On iPhone, add the site to your Home Screen first.');
      return;
    }
    if (!PUBLIC_VAPID_KEY) {
      console.error('VAPID key is missing! Check your .env file.');
      setPushError('Push is not configured (missing VAPID key).');
      return;
    }

    try {
      setPushStatus('loading');

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setPushError('Notifications are blocked. Allow them in your browser/site settings and try again.');
        setPushStatus('idle');
        return;
      }

      const registration = await getActiveRegistration();

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
        });
      }

      await api.post('/webpush/subscribe', {
        subscription: subscription.toJSON(),
        userId,
      });

      setPushStatus('subscribed');
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      setPushError(error?.message || 'Could not enable alerts. Please try again.');
      setPushStatus('idle');
    }
  };

  const handleUnsubscribe = async () => {
    if (!userId) return;
    setPushError('');

    try {
      setPushStatus('loading');

      const registration = await getActiveRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subJSON = subscription.toJSON();

        // 1. Remove ONLY this device's subscription from the backend ($pull)
        await api.delete(`/webpush/unsubscribe/${userId}`, {
          data: { subscription: subJSON, userId },
        });

        // 2. Then revoke it locally in the browser
        await subscription.unsubscribe();
      }

      setPushStatus('idle');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      setPushError('Could not turn off alerts. Please try again.');
      setPushStatus('subscribed'); // revert if the API call fails
    }
  };

  const toggleSubscription = () => {
    if (pushStatus === 'subscribed') handleUnsubscribe();
    else if (pushStatus === 'idle') handleSubscribe();
  };

  return (
    <nav
      className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/80 antialiased shadow-sm font-sans"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className={`flex items-center justify-between h-16 mx-auto w-full transition-all duration-300 ${
          isLoggedIn
            ? 'max-w-6xl px-4 sm:px-6 lg:px-8'
            : 'max-w-7xl px-4 sm:px-6 md:px-12 lg:px-20'
        }`}
      >
        {/* Logo */}
        <Link
          to={isLoggedIn ? '/dashboard' : '/'}
          className="flex items-center gap-2 sm:gap-3 group select-none active:scale-95 transition-transform outline-none rounded-xl focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 transition-all group-hover:shadow-blue-500/40 group-hover:-translate-y-0.5">
            <LayoutDashboard size={20} strokeWidth={2.5} />
          </div>
          <span className="text-[18px] sm:text-[19px] font-extrabold tracking-tight text-gray-900">
            Remind<span className="text-blue-600">Me</span>
          </span>
        </Link>

        {/* Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {!isLoggedIn ? (
            <>
              <Link
                to="/login"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 sm:px-4 text-sm font-semibold rounded-xl hover:bg-gray-100 transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="bg-gray-900 hover:bg-black text-white px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-md hover:shadow-lg whitespace-nowrap"
              >
                Get Started
              </Link>
            </>
          ) : (
            <>
              {/* Push Subscription Button */}
              <button
                onClick={toggleSubscription}
                disabled={pushStatus === 'loading'}
                aria-pressed={pushStatus === 'subscribed'}
                aria-label={pushStatus === 'subscribed' ? 'Turn off alerts' : 'Turn on alerts'}
                className={`group relative flex items-center justify-center gap-2 h-10 px-3 sm:px-4 rounded-full text-sm font-semibold active:scale-95 transition-all duration-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  pushStatus === 'subscribed'
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-600 border border-emerald-200/50 hover:border-rose-200/50'
                    : pushStatus === 'loading'
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-transparent'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900'
                }`}
              >
                {pushStatus === 'loading' && (
                  <Loader2 size={18} strokeWidth={2.5} className="animate-spin text-blue-500" />
                )}

                {pushStatus === 'subscribed' && (
                  <>
                    <BellRing size={18} strokeWidth={2.5} className="block group-hover:hidden text-emerald-600" />
                    <BellOff size={18} strokeWidth={2.5} className="hidden group-hover:block text-rose-500" />
                  </>
                )}

                {pushStatus === 'idle' && (
                  <Bell
                    size={18}
                    strokeWidth={2.5}
                    className="text-gray-500 group-hover:text-blue-500 transition-colors"
                  />
                )}

                <span className="hidden sm:block w-[100px] text-center">
                  {pushStatus === 'loading' ? (
                    'Updating...'
                  ) : pushStatus === 'subscribed' ? (
                    <>
                      <span className="block group-hover:hidden">Alerts on</span>
                      <span className="hidden group-hover:block">Turn off</span>
                    </>
                  ) : (
                    'Turn on alerts'
                  )}
                </span>
              </button>

              {/* New Reminder */}
              <Link
                to="/create-task"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 md:w-auto md:px-4 rounded-full text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label="New reminder"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span className="hidden md:block">New reminder</span>
              </Link>

              <div className="h-6 w-px bg-gray-200 mx-0.5 sm:mx-1" aria-hidden="true"></div>

              {/* Profile Avatar */}
              <Link
                to="/profile"
                aria-label="Your profile"
                className="flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex-shrink-0"
              >
                {avatarUrl ? (
                  <img
                    src={getAvatarSrc()}
                    alt=""
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

      {pushError && (
        <div
          role="alert"
          onClick={() => setPushError('')}
          className="absolute right-4 top-full mt-2 max-w-xs cursor-pointer rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 shadow-md"
        >
          {pushError}
        </div>
      )}
    </nav>
  );
};

export default Header;