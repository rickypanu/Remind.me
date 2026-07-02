import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Share2, Users, BarChart } from "lucide-react";
import api from "../../utils/api";

import WeeklyTimeline from "./WeeklyTimeline";
import SquadGrid from "./SquadGrid";
import SquadFeed from "./SquadFeed";
import StatusModal from "./StatusModal";

export default function SquadDashboard() {
  const { squadId } = useParams();
  const navigate = useNavigate();

  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUserName, setCurrentUserName] = useState("");
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

  const [isCopied, setIsCopied] = useState(false);

  // Create the copy handler
  const handleCopyCode = () => {
    navigator.clipboard.writeText(squad.invite_code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Fetch Initial Data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setIsLoading(true);
        const [squadRes, feedRes, userRes] = await Promise.all([
          api.get(`/squads/${squadId}`),
          api.get(`/squads/${squadId}/chat`),
          api.get("/user/me"),
        ]);

        setSquad(squadRes.data);
        setMembers(squadRes.data.members);
        setFeedItems(feedRes.data);
        setCurrentUserId(userRes.data.id);
        setCurrentUserName(userRes.data.username || "Member");
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (squadId) fetchDashboardData();
  }, [squadId]);

  // SINGLE WebSocket Connection Effect
  useEffect(() => {
    let socket;
    let reconnectTimer;

    const connectWS = () => {
      const wsUrl = import.meta.env.VITE_WS_URL;
      socket = new WebSocket(wsUrl);
      ws.current = socket;

      socket.onopen = () => console.log("WebSocket Successfully Connected!");

      socket.onmessage = (event) => {
        const incoming = JSON.parse(event.data);

        if (incoming.type === "status_update") {
          // 1. Update the ledger live
          setLedger((prev) => ({
            ...prev,
            [incoming.date_str]: {
              ...(prev[incoming.date_str] || {}),
              [incoming.userId]: {
                label: incoming.label,
                emoji: incoming.emoji,
              },
            },
          }));

          // 2. Add the system message to the chat live
          setFeedItems((prev) => {
            if (prev.some((item) => item.id === incoming.id)) return prev;
            return [
              ...prev,
              {
                id: incoming.id,
                type: "system",
                text: incoming.text,
                timestamp: incoming.timestamp,
              },
            ];
          });
        } else {
          setFeedItems((prev) => [...prev, incoming]);
        }
      };

      socket.onerror = (error) => {
        console.warn("WebSocket Interrupted", error);
      };

      socket.onclose = () => {
        console.log("WebSocket Disconnected. Reconnecting in 3 seconds...");
        reconnectTimer = setTimeout(connectWS, 3000);
      };
    };

    connectWS();

    return () => {
      clearTimeout(reconnectTimer);
      if (socket) {
        socket.onclose = null; // Prevent reconnect loop on intentional unmount
        socket.close();
      }
    };
  }, []);

  // Fetch Ledger when date changes
  useEffect(() => {
    const fetchLedgerForDate = async () => {
      try {
        const res = await api.get(`/squads/${squadId}/status`, {
          params: { date_str: dateKey },
        });

        setLedger((prev) => ({
          ...prev,
          [dateKey]: res.data.entries || {},
        }));
      } catch (error) {
        console.error("Failed to fetch ledger:", error);
      }
    };

    if (squadId) fetchLedgerForDate();
  }, [squadId, dateKey]);

  // Handle Status Update
  const handleStatusUpdate = async (label, emoji) => {
    // Optimistic local update
    setLedger((prev) => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [currentUserId]: { label, emoji },
      },
    }));

    try {
      await api.post(`/squads/${squadId}/status`, {
        date_str: dateKey,
        label,
        emoji,
      });

      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        const statusBroadcast = {
          id: `sys-${Date.now()}`,
          type: "status_update",
          userId: currentUserId,
          userName: currentUserName,
          label: label,
          emoji: emoji,
          date_str: dateKey,
          text: `${currentUserName} updated their status to ${emoji} ${label}`,
          timestamp: new Date().toISOString(),
        };
        ws.current.send(JSON.stringify(statusBroadcast));
      }

      const feedRes = await api.get(`/squads/${squadId}/chat`);
      setFeedItems(feedRes.data);
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  // Send chat message
  const handleSendMessage = async (text) => {
    const newMessage = {
      id: `ws-${Date.now()}`,
      type: "chat",
      userId: currentUserId,
      userName: currentUserName,
      text: text,
      timestamp: new Date().toISOString(),
    };

    try {
      await api.post(`/squads/${squadId}/chat`, { text: text });

      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify(newMessage));
      } else {
        console.error(
          "Message saved to DB, but WebSocket is disconnected. Others won't see it until they refresh."
        );
      }
    } catch (error) {
      console.error("Failed to save message to the database:", error);
    }
  };

  // --- UI RENDERING ---

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
        <span className="text-sm font-medium tracking-wide">Loading squad...</span>
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl border border-gray-200 text-center max-w-md mx-auto">
          <div className="w-12 h-12 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Squad Not Found</h2>
          <p className="text-gray-500 text-sm mb-6">
            We couldn't locate this squad. The link might be expired or broken.
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2.5 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors w-full flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" /> Go Back
          </button>
        </div>
      </div>
    );
  }

  const activeCount = Object.keys(currentDayStatuses).length;
  const totalMembers = members.length;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Top Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Squads
          </button>

          <div className="flex items-center gap-2 text-xs bg-green-50 text-green-700 font-medium px-3 py-1.5 rounded-full border border-green-200">
            <span className={`w-2 h-2 rounded-full ${activeCount > 0 ? "bg-green-500" : "bg-gray-300"}`}></span>
            {activeCount} / {totalMembers} Active Today
          </div>
        </div>

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight mb-2">
              {squad.name}
            </h1>
            <div className="flex items-center gap-2 text-gray-600">
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider">
                Goal
              </span>
              <p className="text-sm">{squad.goal}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <button
              onClick={handleCopyCode}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors border ${
                isCopied
                  ? "bg-green-50 text-green-700 border-green-200"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              <Share2 className="w-4 h-4" />
              {isCopied ? "Copied!" : squad.invite_code}
            </button>

            <button
              onClick={() => navigate(`/squad/${squadId}/analytics`)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white font-medium hover:bg-gray-800 transition-colors"
            >
              <BarChart className="w-4 h-4" />
              View Report
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
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