import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Share2, Users } from 'lucide-react';
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

  // First WebSocket Connection Effect (Kept to preserve your original logic)
  useEffect(() => {
    let socket;
    const connect = () => {
      socket = new WebSocket(import.meta.env.VITE_WS_URL);

      socket.onopen = () => console.log("Connected");
      socket.onmessage = (event) => { /* ... handle message ... */ };
      
      // Auto-reconnect logic
      socket.onclose = () => {
        console.log("Disconnected. Reconnecting in 3 seconds...");
        setTimeout(connect, 3000);
      };
    };

    connect();
    return () => socket.close();
  }, []);

  // Second WebSocket Connection Effect (Populates Chat)
  useEffect(() => {
    const wsUrl = import.meta.env.VITE_WS_URL;
    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      console.log("WebSocket Successfully Connected!");
    };

    socket.onmessage = (event) => {
      const incomingMessage = JSON.parse(event.data);
      setFeedItems((prev) => [...prev, incomingMessage]);
    };

    socket.onerror = (error) => {
      console.warn("WebSocket Interrupted (Safe to ignore if Strict Mode caused it)");
    };

    socket.onclose = () => {
      console.log("WebSocket Disconnected.");
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

  // Send chat message (Hybrid: Save to DB, then Broadcast via WS)
  const handleSendMessage = async (text) => {
    const newMessage = {
      id: `ws-${Date.now()}`,
      type: 'chat',
      userId: currentUserId,
      userName: 'You', 
      text: text,
      timestamp: new Date().toISOString()
    };

    try {
      await api.post(`/squads/${squadId}/chat`, { text: text });

      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(newMessage));
      } else {
        console.error("Message saved to DB, but WebSocket is disconnected. Others won't see it until they refresh.");
      }
    } catch (error) {
      console.error("Failed to save message to the database:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/50 flex flex-col items-center justify-center text-slate-500 gap-4">
        <div className="relative flex items-center justify-center">
          <div className="absolute w-12 h-12 border-4 border-indigo-200 rounded-full animate-ping opacity-75"></div>
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 relative z-10" />
        </div>
        <span className="text-sm font-semibold tracking-wide animate-pulse">Loading your squad...</span>
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 text-center max-w-md mx-auto">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Users className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-3">Squad Not Found</h2>
          <p className="text-slate-500 text-sm mb-8 leading-relaxed">
            We couldn't locate this squad. The link might be expired, broken, or you might not have access.
          </p>
          <button 
            onClick={() => navigate(-1)} 
            className="px-6 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 hover:shadow-lg hover:-translate-y-0.5 transition-all w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  // Calculate active members for the functional badge
  const activeCount = Object.keys(currentDayStatuses).length;
  const totalMembers = members.length;

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 p-4 sm:p-6 md:p-8 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
          
          {/* Subtle background decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl opacity-60 -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>

          <div className="flex flex-col items-start gap-5 relative z-10 w-full md:w-auto">
            <button
              onClick={() => navigate(-1)}
              className="group flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors"
            >
              <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-slate-200 transition-colors">
                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> 
              </div>
              Back
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900">{squad.name}</h1>
                
                {/* Functional Active Badge */}
                <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-700 font-bold px-3 py-1.5 rounded-full border border-emerald-200/60 shadow-sm">
                  <span className="relative flex h-2 w-2">
                    {activeCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${activeCount > 0 ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                  </span>
                  {activeCount} / {totalMembers} Active Today
                </div>
              </div>
              
              <div className="flex items-center gap-2 text-slate-500 font-medium">
                <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs uppercase tracking-wider font-bold">Goal</span>
                <p className="text-sm">{squad.goal}</p>
              </div>
            </div>
          </div>
          
          {/* Invite Code Box */}
          <div className="bg-gradient-to-b from-slate-50 to-white border border-slate-200/80 p-4 rounded-2xl w-full md:w-auto min-w-[200px] shadow-sm relative z-10 flex flex-col items-start md:items-end group hover:border-indigo-200 transition-colors">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-slate-400 font-bold mb-2">
              <Share2 className="w-3.5 h-3.5 group-hover:text-indigo-500 transition-colors" /> Invite Code
            </div>
            <div className="flex items-center justify-between w-full md:justify-end gap-4">
              <p className="text-2xl font-mono font-black text-slate-800 tracking-wider bg-slate-100 px-3 py-1 rounded-lg border border-slate-200/50 select-all">
                {squad.invite_code}
              </p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid & Feed */}
        <div className="space-y-8">
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