import React from 'react';

export default function WeeklyTimeline({ selectedDate, onDateSelect }) {
  // Generate the last 7 days including today
  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  const isToday = (date) => new Date().toDateString() === date.toDateString();
  const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
      <h3 className="text-gray-500 text-xs font-bold mb-3 tracking-widest uppercase">Select Ledger Date</h3>
      <div className="grid grid-cols-7 gap-2">
        {days.map((date) => {
          const selected = isSameDay(date, selectedDate);
          const today = isToday(date);
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={`flex flex-col items-center p-3 rounded-xl transition-all duration-200 ${
                selected 
                  ? 'bg-black text-white scale-105 shadow-md' 
                  : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-black border border-transparent hover:border-gray-200'
              }`}
            >
              <span className="text-xs font-medium opacity-80 uppercase tracking-wide">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              <span className="text-xl font-bold mt-0.5">
                {date.getDate()}
              </span>
              {today && (
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${selected ? 'bg-white' : 'bg-gray-400'}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}