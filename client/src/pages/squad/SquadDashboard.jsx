import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Share2 } from 'lucide-react';
import api from '../../utils/api';

import WeeklyTimeline from './WeeklyTimeline';
import SquadGrid from './SquadGrid';
import SquadFeed from './SquadFeed';
import StatusModal from './StatusModal';

export default function SquadDashboard() {
  const { squadId } = useParams();
  const navigate = useNavigate();
  
  const [currentUserId, setCurrentUserId] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Real State for API Data
  const [squad, setSquad] = useState(null);
  const [members, setMembers] = useState([]);
  const [ledger, setLedger] = useState({});
  const [feedItems, setFeedItems] = useState([]);

  // Reference for the WebSocket
  const ws = useRef(null);

  const dateKey = selectedDate.toDateString();
  const currentDayStatuses = ledger[dateKey] || {};

  // Fetch Initial Data (Past messages, squad info, etc.)
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const [squadRes, feedRes, userRes] = await Promise.all([
          api.get(`/squads/${squadId}`),
          api.get(`/squads/${squadId}/chat`), // Gets message history
          api.get("/user/me")
        ]);
        
        setSquad(squadRes.data);
        setMembers(squadRes.data.members);
        setFeedItems(feedRes.data);
        setCurrentUserId(userRes.data.id); 
        
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (squadId) fetchDashboardData();
  }, [squadId]);

  // The WebSocket Connection Effect
  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8000/chat');
    ws.current = socket;

    socket.onopen = () => {
      console.log("🟢 WebSocket Successfully Connected!");
    };

    socket.onmessage = (event) => {
      const incomingMessage = JSON.parse(event.data);
      setFeedItems((prev) => [...prev, incomingMessage]);
    };

    socket.onerror = (error) => {
      console.warn("🔴 WebSocket Interrupted (Safe to ignore if Strict Mode caused it)");
    };

    socket.onclose = () => {
      console.log("⚪ WebSocket Disconnected.");
    };

    return () => {
      socket.close();
    };
  }, []); 

  // Fetch Ledger when date changes
  useEffect(() => {
    const fetchLedgerForDate = async () => {
      try {
        const res = await api.get(`/squads/${squadId}/status`, {
          params: { date_str: dateKey }
        });
        
        setLedger(prev => ({
          ...prev,
          [dateKey]: res.data.entries || {}
        }));
      } catch (error) {
        console.error("Failed to fetch ledger:", error);
      }
    };

    if (squadId) fetchLedgerForDate();
  }, [squadId, dateKey]);

  // Handle Status Update
  const handleStatusUpdate = async (label, emoji) => {
    setLedger(prev => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [currentUserId]: { label, emoji }
      }
    }));

    try {
      await api.post(`/squads/${squadId}/status`, {
        date_str: dateKey,
        label,
        emoji
      });
      const feedRes = await api.get(`/squads/${squadId}/chat`);
      setFeedItems(feedRes.data);
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  // Send chat message via WebSocket
  // Send chat message (Hybrid: Save to DB, then Broadcast via WS)
  const handleSendMessage = async (text) => {
    // 1. Construct the message object to broadcast
    const newMessage = {
      id: `ws-${Date.now()}`,
      type: 'chat',
      userId: currentUserId,
      userName: 'You', // Or use your actual user state
      text: text,
      timestamp: new Date().toISOString()
    };

    try {
      // 2. SAVE IT FIRST: Hit your FastAPI POST endpoint to save to MongoDB
      // Make sure the URL perfectly matches your backend routing
      await api.post(`/squads/${squadId}/chat`, { text: text });

      // 3. BROADCAST IT: Send it through the WebSocket to everyone else
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(newMessage));
      } else {
        console.error("Message saved to DB, but WebSocket is disconnected. Others won't see it until they refresh.");
      }
    } catch (error) {
      console.error("Failed to save message to the database:", error);
      // Optional: Add a toast notification here to tell the user the message failed to send
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <span className="text-sm font-medium animate-pulse">Loading your squad...</span>
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm mx-auto">
          <h2 className="text-xl font-bold text-slate-800 mb-2">Squad Not Found</h2>
          <p className="text-slate-500 text-sm mb-6">We couldn't locate this squad. The link might be expired or broken.</p>
          <button onClick={() => navigate(-1)} className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors w-full">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-4 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          
          <div className="flex flex-col items-start gap-4">
            <button
              onClick={() => navigate(-1)}
              className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 bg-slate-50 hover:bg-indigo-50 px-4 py-2 rounded-xl border border-slate-200 hover:border-indigo-200 transition-all"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
              Back
            </button>

            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-black tracking-tight text-slate-900">{squad.name}</h1>
                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-md uppercase tracking-widest border border-emerald-200">
                  Active
                </span>
              </div>
              <p className="text-sm text-slate-500 font-medium">Goal: {squad.goal}</p>
            </div>
          </div>
          
          <div className="bg-slate-50 border border-slate-200 px-5 py-3 rounded-xl w-full md:w-auto flex flex-col items-start md:items-end hover:border-slate-300 transition-colors">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">
              <Share2 className="w-3 h-3" /> Invite Code
            </div>
            <p className="text-xl font-mono font-bold text-slate-800 tracking-wide">{squad.invite_code}</p>
          </div>

        </div>

        <WeeklyTimeline 
          selectedDate={selectedDate} 
          onDateSelect={setSelectedDate} 
        />

        <SquadGrid 
          members={members} 
          selectedDateStatus={currentDayStatuses}
          currentUserId={currentUserId}
          onOpenStatusModal={() => setIsModalOpen(true)}
        />

        <SquadFeed 
          feedItems={feedItems} 
          onSendMessage={handleSendMessage} 
          currentUserId={currentUserId} 
        />

      </div>

      <StatusModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        statusOptions={squad.status_options}
        onSelectStatus={handleStatusUpdate}
        date={selectedDate}
      />
    </div>
  );
}