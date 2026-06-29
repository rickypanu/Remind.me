import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../utils/api";
import CreateSquadModal from "./CreateSquadModal";
import { ArrowLeft, Users, Plus, ArrowRight, Loader2, Sparkles } from "lucide-react";

export default function SquadLobby() {
  const navigate = useNavigate();
  
  // State Management
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [mySquads, setMySquads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState("");

  const fetchMySquads = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/squads/my-squads");
      setMySquads(res.data);
    } catch (error) {
      console.error("Failed to fetch squads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMySquads();
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    
    setIsJoining(true);
    setJoinError("");
    
    try {
      const res = await api.post("/squads/join", { invite_code: joinCode });
      setJoinCode("");
      navigate(`/squad/${res.data.squad_id}`);
    } catch (error) {
      console.error("Join failed:", error);
      setJoinError(error.response?.data?.detail || "Invalid invite code.");
    } finally {
      setIsJoining(false);
    }
  };

  const handleEnterSquad = (squadId) => {
    navigate(`/squad/${squadId}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 p-6 sm:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 space-y-6">
          <button
            onClick={() => navigate(-1)}
            className="group inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-indigo-600 bg-white hover:bg-indigo-50 px-4 py-2 rounded-xl border border-slate-200 hover:border-indigo-200 transition-all shadow-sm w-fit"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> 
            Back 
          </button>
          
          <div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">
              Your Squads
            </h1>
            <p className="text-slate-500 mt-2 text-lg font-medium">
              Team up, stay accountable, and crush your goals.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Actions (Join / Create) */}
          <div className="space-y-6">
            
            {/* 💅 UPGRADE: Premium Create Card */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -mr-10 -mt-10 opacity-60 group-hover:bg-indigo-100 transition-colors duration-500"></div>
              
              <div className="flex items-center gap-2 mb-2 relative z-10">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h2 className="text-xl font-bold text-slate-900">
                  Start a Movement
                </h2>
              </div>
              
              <p className="text-sm text-slate-500 mb-6 relative z-10">
                Create a new accountability squad and invite your friends.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-indigo-600 text-white font-semibold py-3 rounded-xl transition-colors shadow-sm relative z-10"
              >
                <Plus className="w-5 h-5" /> Create New Squad
              </button>
            </div>

            {/* 💅 UPGRADE: Join Card */}
            <div className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-2">
                Have an Invite?
              </h2>
              <p className="text-sm text-slate-500 mb-4">
                Paste your squad invite code below.
              </p>
              <form onSubmit={handleJoin} className="flex flex-col gap-3">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g., sq_abc123"
                  className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                  disabled={isJoining}
                />
                {joinError && (
                  <span className="text-xs text-red-500 font-semibold px-1">{joinError}</span>
                )}
                <button
                  type="submit"
                  disabled={isJoining}
                  className="w-full bg-white hover:bg-slate-50 border border-slate-200 text-slate-900 font-semibold py-3 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isJoining ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Joining...</>
                  ) : "Join Squad"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Existing Squads Grid */}
          <div className="lg:col-span-2">
            <h3 className="text-lg font-bold text-slate-900 mb-4 border-b border-slate-200 pb-3 flex items-center gap-2">
              Active Memberships
            </h3>

            {isLoading ? (
              <div className="flex flex-col justify-center items-center h-64 text-slate-400 gap-3 bg-white/50 border border-slate-100 rounded-2xl">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                <span className="animate-pulse font-medium text-sm">Loading your squads...</span>
              </div>
            ) : mySquads.length === 0 ? (
              
              <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-slate-700 font-semibold text-lg mb-1">No active squads</p>
                <p className="text-sm text-slate-500 max-w-sm">Create a new movement or join an existing squad using an invite code to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {mySquads.map((squad) => (
                  
                  
                  <div
                    key={squad.id}
                    onClick={() => handleEnterSquad(squad.id)}
                    className="bg-white border border-slate-200 hover:border-indigo-200 hover:shadow-md cursor-pointer p-6 rounded-2xl transition-all duration-200 group relative flex flex-col h-full hover:-translate-y-1"
                  >
                    <div className="flex justify-between items-start mb-6">
                      <h4 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors pr-4">
                        {squad.name}
                      </h4>
                      {squad.role === "Author" && (
                        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 rounded-md uppercase font-bold tracking-wider shrink-0">
                          Author
                        </span>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center text-sm text-slate-500 font-medium bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                        <Users className="w-4 h-4 mr-2 text-slate-400" />
                        {squad.members} Members
                      </div>
                      
                      {/* Hidden arrow that slides in on hover */}
                      <ArrowRight className="w-5 h-5 text-indigo-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <CreateSquadModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSquadCreated={(newSquad) => {
            fetchMySquads(); 
          }}
        />
      </div>
    </div>
  );
}