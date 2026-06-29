import React from 'react';

export default function SquadGrid({ members, selectedDateStatus, currentUserId, onOpenStatusModal }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 mb-6 shadow-sm">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Squad Members</h2>
          <p className="text-xs text-gray-500 mt-1">
            Total Members: {members.length} • {members.filter(m => m.isOnline).length} Active Now
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {members.map((member) => {
          const dayLog = selectedDateStatus[member.id] || { label: 'Pending', emoji: '⏳' };
          const isSelf = member.id === currentUserId;

          return (
            <div 
              key={member.id} 
              className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between shadow-sm relative group hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white font-bold uppercase tracking-wider text-sm">
                    {member.name.substring(0, 2)}
                  </div>
                  {member.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-gray-50 rounded-full animate-pulse" />
                  )}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                    {member.name} 
                    {isSelf && (
                      <span className="text-[9px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold tracking-wide">
                        YOU
                      </span>
                    )}
                  </h4>
                  <p className="text-xs text-gray-500 mt-0.5">Role: {member.role}</p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="text-right">
                  <span className="text-2xl" title={dayLog.label}>{dayLog.emoji}</span>
                  <p className="text-[10px] text-gray-500 font-bold tracking-wide uppercase mt-1">{dayLog.label}</p>
                </div>

                {isSelf && (
                  <button 
                    onClick={onOpenStatusModal}
                    className="p-1.5 text-gray-400 hover:text-black hover:bg-gray-200 rounded-lg transition-all"
                    title="Change Status"
                  >
                    ✏️
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