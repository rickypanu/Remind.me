import { useState, useEffect } from 'react';
import { webpushApi } from '../api';
import useMe, { userIdOf } from '../hooks/useMe';
import notify from './notify';

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

// The service worker is registered by components/UpdatePrompt.jsx (vite-plugin-pwa).
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

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** Push notification on/off logic, shared by the desktop button and the mobile menu button. */
export default function usePush(isLoggedIn) {
  const [pushStatus, setPushStatus] = useState('idle'); // 'idle' | 'loading' | 'subscribed'
  const [permission, setPermission] = useState(() =>
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  const me = useMe({ enabled: !!isLoggedIn });
  const avatarUrl = me.data?.avatar_url || null;
  const userId = userIdOf(me.data);

  // Subscription state is per DEVICE, so the browser is the source of truth.
  // If this browser is already subscribed, re-send it to the backend
  // (idempotent via $addToSet) so a lost DB record heals itself.
  useEffect(() => {
    if (!isLoggedIn || !userId || !pushSupported()) return;
    let cancelled = false;
    (async () => {
      try {
        const registration = await getActiveRegistration();
        const existing = await registration.pushManager.getSubscription();
        if (!existing || cancelled) return;
        setPushStatus('subscribed');
        await webpushApi.subscribe(existing.toJSON());
      } catch (error) {
        console.error('Error checking local push subscription:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, userId]);

  const handleSubscribe = async () => {
    if (pushStatus === 'subscribed' || !userId) return;

    if (!pushSupported()) {
      notify.error('Push is not supported here. On iPhone, add the site to your Home Screen first.');
      return;
    }
    if (!PUBLIC_VAPID_KEY) {
      console.error('VAPID key is missing! Check your .env file.');
      notify.error('Push alerts are not configured on this site yet.');
      return;
    }

    try {
      setPushStatus('loading');

      const result = await Notification.requestPermission();
      setPermission(result);
      if (result !== 'granted') {
        notify.error('Notifications are blocked. Allow them in your browser or site settings and try again.');
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

      await webpushApi.subscribe(subscription.toJSON());

      setPushStatus('subscribed');
      notify.success('Alerts are on for this device.');
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      notify.error(error, 'Could not enable alerts. Please try again.');
      setPushStatus('idle');
    }
  };

  const handleUnsubscribe = async () => {
    if (!userId) return;

    try {
      setPushStatus('loading');

      const registration = await getActiveRegistration();
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        const subJSON = subscription.toJSON();

        // 1. Remove ONLY this device's subscription from the backend ($pull)
        await webpushApi.unsubscribe(subJSON.endpoint);

        // 2. Then revoke it locally in the browser
        await subscription.unsubscribe();
      }

      setPushStatus('idle');
      notify.success('Alerts are off for this device.');
    } catch (error) {
      console.error('Failed to unsubscribe:', error);
      notify.error(error, 'Could not turn off alerts. Please try again.');
      setPushStatus('subscribed'); // revert if the API call fails
    }
  };

  const toggle = () => {
    if (pushStatus === 'subscribed') handleUnsubscribe();
    else if (pushStatus === 'idle') handleSubscribe();
  };

  return { avatarUrl, userId, pushStatus, toggle, permission, supported: pushSupported() };
}

