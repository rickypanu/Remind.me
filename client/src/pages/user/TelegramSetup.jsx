import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, CheckCircle2, AlertCircle, Loader2, MessageCircle } from 'lucide-react';
import api from '../../utils/api';

export default function TelegramSetup() {
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

      window.open(telegram_url, '_blank');

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

  // --- Loading State ---
  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFC] flex flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
        <span className="text-gray-500 font-medium">Syncing connection...</span>
      </div>
    );
  }

  // --- Error State ---
  if (errorMsg || !userId) {
    return (
      <div className="min-h-screen bg-[#FAFAFC] flex flex-col items-center justify-center p-4">
        <div className="bg-white border border-gray-100 rounded-3xl p-8 text-center max-w-sm w-full shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-500 mb-8">{errorMsg || 'Unable to authenticate session.'}</p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 bg-gray-900 text-white font-semibold rounded-xl hover:bg-black transition-all active:scale-[0.98]"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFC] pb-12 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      
      {/* iOS-Style Header */}
      <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3 relative">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="absolute left-0 p-2 -ml-2 text-blue-500 hover:opacity-70 transition-opacity flex items-center gap-1"
          >
            <ArrowLeft size={22} strokeWidth={2.5} />
          </button>
          <h1 className="w-full text-center text-[17px] font-semibold text-gray-900 tracking-tight">
            Telegram Alerts
          </h1>
        </div>
      </nav>

      <main className="max-w-xl mx-auto px-4 mt-8">
        
        {/* Header Section */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#0088cc]/10 text-[#0088cc] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm">
            <Send size={32} strokeWidth={2.2} className="ml-1" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
            Never miss a deadline.
          </h2>
          <p className="text-gray-500 font-medium px-4">
            Get instant, reliable push notifications directly to your Telegram app exactly when you need them.
          </p>
        </div>

        {/* 1. Connection Status & Actions (MOVED UP) */}
        <div className="bg-white border border-gray-100 rounded-[2rem] p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-10">
          {isConnected ? (
            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={28} className="text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1">Connected</h3>
              <p className="text-gray-500 font-medium mb-6">
                Your account is actively linked to RemindMe Bot.
              </p>
              
              {phoneNumber && (
                <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-6 w-full flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500">Linked Phone</span>
                  <span className="text-sm font-semibold text-gray-900">{phoneNumber}</span>
                </div>
              )}

              <button
                onClick={handleDisconnect}
                className="w-full py-3.5 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition-colors active:scale-[0.98]"
              >
                Disconnect Account
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4">How to connect</h3>
              
              <div className="space-y-4 mb-8 relative before:absolute before:inset-0 before:ml-3.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent hidden sm:block" />
              
              <ul className="space-y-5 mb-8">
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 border border-blue-100">1</div>
                  <div className="pt-1.5">
                    <p className="text-[15px] font-medium text-gray-700">Click the connect button below</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 border border-blue-100">2</div>
                  <div className="pt-1.5">
                    <p className="text-[15px] font-medium text-gray-700">Tap <span className="font-bold text-gray-900">START</span> in the Telegram app</p>
                  </div>
                </li>
                <li className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 font-bold flex items-center justify-center shrink-0 border border-blue-100">3</div>
                  <div className="pt-1.5">
                    <p className="text-[15px] font-medium text-gray-700">Share your contact when prompted to finish linking</p>
                  </div>
                </li>
              </ul>

              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="w-full py-4 bg-[#0088cc] hover:bg-[#0077b5] text-white text-[16px] font-semibold rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Waiting for Telegram...</span>
                  </>
                ) : (
                  <>
                    <Send size={20} />
                    <span>Connect Telegram</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* 2. Telegram Chat Mockup (MOVED DOWN AS PREVIEW) */}
        <div className="flex items-center gap-2 mb-4 px-2">
          <MessageCircle size={18} className="text-gray-400" />
          <h3 className="text-[15px] font-semibold text-gray-500 uppercase tracking-wider">Preview</h3>
        </div>
        
        <div className="bg-[#E5E5EA] rounded-[2rem] p-4 sm:p-6 mb-8 border border-gray-200/50 shadow-inner overflow-hidden relative">
          {/* Subtle chat background pattern */}
          <div className="absolute inset-0 opacity-[0.03] bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
          
          <div className="relative z-10 flex flex-col gap-3 max-w-[85%]">
            
            {/* Mock Message 1 */}
            <div className="bg-white p-3.5 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100/50">
              <div className="flex items-center gap-1.5 text-[#0088cc] font-semibold text-[13px] mb-1">
                RemindMe Bot
              </div>
              <p className="text-[15px] text-gray-800 leading-snug">
                Hey! Your task <span className="font-semibold">"Algorithm Final Prep"</span> is due in 30 minutes. ⏰
              </p>
              <div className="text-[11px] text-gray-400 text-right mt-1 font-medium">
                10:42 AM
              </div>
            </div>

            {/* Mock Message 2 */}
            <div className="bg-white p-3.5 rounded-2xl rounded-tl-sm shadow-sm border border-gray-100/50">
              <p className="text-[15px] text-gray-800 leading-snug">
                <span className="font-semibold text-red-500">Urgent:</span> "Submit Visa Application" is due today!
              </p>
              <div className="text-[11px] text-gray-400 text-right mt-1 font-medium">
                2:15 PM
              </div>
            </div>

          </div>
        </div>

      </main>
    </div>
  );
}