import React from 'react';
import { Edit2 } from 'lucide-react';

export default function SquadGrid({ members, selectedDateStatus, currentUserId, onOpenStatusModal }) {
  return (
    <div className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 mb-6 shadow-sm">
      
      {/* Header Section */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Squad Members</h2>
          <p className="text-sm text-slate-500 font-medium mt-1">
            Total Members: {members.length}
          </p>
        </div>
      </div>

      {/* Grid Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
        {members.map((member) => {
          const dayLog = selectedDateStatus[member.id] || { label: 'Pending', emoji: '⏳' };
          const isSelf = member.id === currentUserId;
          const isPending = dayLog.label === 'Pending';

          // Safely grab the name (handling both name or username just in case)
          const displayName = member.name || member.username || "Unknown";

          return (
            <div 
              key={member.id} 
              // Changed to flex-col so the top and bottom stack naturally
              className={`bg-white border rounded-2xl p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-all duration-200 group ${
                isSelf ? 'border-indigo-200 ring-1 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              
              {/* TOP SECTION: Avatar & User Info */}
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  {/* Modern Avatar */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold uppercase tracking-wider text-sm shadow-inner ${
                    isSelf 
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                      : 'bg-gradient-to-br from-slate-700 to-slate-900'
                  }`}>
                    {displayName.substring(0, 3)}
                  </div>
                  
                  {/* Individual Online Indicator */}
                  {member.isOnline && (
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>
                
                {/* User Details (Now has the full width of the card) */}
                <div className="flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-900 break-words leading-tight">
                      {displayName} 
                    </h4>
                    {isSelf && (
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-black tracking-widest uppercase border border-indigo-100">
                        You
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 font-medium mt-1">{member.role}</p>
                </div>
              </div>

              {/* BOTTOM SECTION: Status & Edit Action */}
              {/* Added a subtle top border to separate it from the profile */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100/80">
                
                <div className={`flex items-center gap-2.5 ${isPending ? 'opacity-60' : 'opacity-100'}`}>
                  <span className="text-xl drop-shadow-sm" title={dayLog.label}>
                    {dayLog.emoji}
                  </span>
                  <p className="text-[10px] text-slate-600 font-bold tracking-wide uppercase">
                    {dayLog.label}
                  </p>
                </div>

                {isSelf && (
                  <button 
                    onClick={onOpenStatusModal}
                    className="flex items-center gap-1.5 p-1.5 pr-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    title="Update Status"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span className="text-xs font-bold uppercase tracking-wider">Edit</span>
                  </button>
                )}
                
              </div>
              
            </div>
          );
        })}
      </div>
    </div>
  );
}