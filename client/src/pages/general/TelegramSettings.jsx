import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import api from '../../utils/api';

export default function TelegramSettingsPage() {
  const navigate = useNavigate();

  // User & State Management
  const [userId, setUserId] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const intervalRef = useRef(null);

  // 1. Fetch Current Logged-in User from /me endpoint
  useEffect(() => {
    let isMounted = true;

    const fetchCurrentUser = async () => {
      try {
        const response = await api.get('/user/me');
        if (isMounted && response.data?.id) {
          setUserId(response.data.id);
        }
      } catch (err) {
        console.error('Failed to get current user:', err);
        if (isMounted) {
          setErrorMsg('Authentication failed. Please log in again.');
          setLoading(false);
        }
      }
    };

    fetchCurrentUser();

    return () => {
      isMounted = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // 2. Fetch Telegram Connection Status once userId is available
  useEffect(() => {
    if (!userId) return;

    const fetchStatus = async () => {
      try {
        const res = await api.get(`/telegram/status/${userId}`);
        setIsConnected(res.data.connected);
        if (res.data.phone_number) {
          setPhoneNumber(res.data.phone_number);
        }
      } catch (err) {
        console.error('Failed to fetch Telegram status:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [userId]);

  // 3. Connect Handler
  const handleConnect = async () => {
    if (!userId) {
      alert('User session not found. Please log in again.');
      return;
    }

    try {
      setIsConnecting(true);
      const res = await api.post('/telegram/get-link', { userId });
      const { telegram_url } = res.data;

      // Open Telegram Bot in new window/tab
      window.open(telegram_url, '_blank');

      // Poll every 3 seconds for active connection
      intervalRef.current = setInterval(async () => {
        try {
          const checkRes = await api.get(`/telegram/status/${userId}`);
          if (checkRes.data.connected) {
            setIsConnected(true);
            setIsConnecting(false);
            if (checkRes.data.phone_number) {
              setPhoneNumber(checkRes.data.phone_number);
            }
            clearInterval(intervalRef.current);
          }
        } catch (e) {
          console.error('Polling error:', e);
        }
      }, 3000);

      // Stop polling after 60 seconds
      setTimeout(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setIsConnecting(false);
      }, 60000);
    } catch (err) {
      alert('Error generating Telegram link.');
      setIsConnecting(false);
    }
  };

  // 4. Disconnect Handler
  const handleDisconnect = async () => {
    try {
      await api.post('/telegram/disconnect', { userId });
      setIsConnected(false);
      setPhoneNumber('');
    } catch (err) {
      alert('Error disconnecting Telegram.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-gray-600 font-medium">
          <Loader2 className="animate-spin text-indigo-600" size={20} />
          <span>Loading Telegram Integration...</span>
        </div>
      </div>
    );
  }

  if (errorMsg || !userId) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center max-w-sm w-full shadow-sm">
          <AlertCircle className="mx-auto text-red-500 mb-3" size={40} />
          <h2 className="text-lg font-bold text-gray-900 mb-1">Access Denied</h2>
          <p className="text-sm text-gray-500 mb-6">{errorMsg || 'Unable to authenticate session.'}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <nav className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="p-2 -ml-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">Telegram Integration</h1>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
              <Send size={28} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight">Telegram Notifications</h2>
              <p className="text-sm text-gray-500 mt-1">
                Receive instant task reminders directly on your Telegram account.
              </p>
            </div>
          </div>

          <hr className="border-gray-100 mb-6" />

          {isConnected ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
              <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                <CheckCircle2 size={18} />
                <span>Connected</span>
              </div>
              <p className="text-sm text-emerald-900 mb-1">
                Your account is linked with RemindMe Bot.
              </p>
              {phoneNumber && (
                <p className="text-xs text-emerald-700 font-medium mb-4">
                  Linked Phone: {phoneNumber}
                </p>
              )}
              <button
                onClick={handleDisconnect}
                className="mt-2 px-4 py-2 bg-red-600 text-white text-xs font-semibold rounded-xl hover:bg-red-700 transition-colors"
              >
                Disconnect Telegram Account
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-gray-900">How to connect:</h4>
              <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2 pl-1">
                <li>Click <strong>Connect Telegram</strong> below.</li>
                <li>Press <strong>START</strong> in the opened Telegram bot.</li>
                <li>Optionally share your phone number inside the chat to finish setup.</li>
              </ol>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full mt-4 py-3 bg-[#0088cc] hover:bg-[#0077b5] text-white font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    <span>Waiting for Telegram Start...</span>
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    <span>Connect Telegram</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}