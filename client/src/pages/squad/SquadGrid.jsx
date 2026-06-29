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

          return (
            <div 
              key={member.id} 
              className={`bg-white border rounded-2xl p-4 flex items-center justify-between shadow-sm hover:shadow-md transition-all duration-200 group ${
                isSelf ? 'border-indigo-200 ring-1 ring-indigo-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              
              {/* Left Side: Avatar & Info */}
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {/* Modern Avatar */}
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold uppercase tracking-wider text-sm shadow-inner ${
                    isSelf 
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600' 
                      : 'bg-gradient-to-br from-slate-700 to-slate-900'
                  }`}>
                    {member.name.substring(0, 2)}
                  </div>
                  
                  {/* Individual Online Indicator */}
                  {member.isOnline && (
                    <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
                  )}
                </div>
                
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    {member.name} 
                    {isSelf && (
                      <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-black tracking-widest uppercase border border-indigo-100">
                        You
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">{member.role}</p>
                </div>
              </div>

              {/* Right Side: Status & Edit Action */}
              <div className="flex items-center space-x-3">
                <div className={`text-right flex flex-col items-center justify-center min-w-[60px] ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                  <span className="text-2xl drop-shadow-sm" title={dayLog.label}>
                    {dayLog.emoji}
                  </span>
                  <p className="text-[10px] text-slate-500 font-bold tracking-wide uppercase mt-1 text-center truncate max-w-[70px]">
                    {dayLog.label}
                  </p>
                </div>

                {isSelf && (
                  <button 
                    onClick={onOpenStatusModal}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-100"
                    title="Update Status"
                  >
                    <Edit2 className="w-4 h-4" />
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