import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

export default function WeeklyTimeline({ selectedDate, onDateSelect }) {
  const [weekOffset, setWeekOffset] = useState(0);

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i) + (weekOffset * 7));
    return d;
  });

  const isToday = (date) => new Date().toDateString() === date.toDateString();
  const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString();

  const handlePrevWeek = () => setWeekOffset(prev => prev - 1);
  const handleNextWeek = () => setWeekOffset(prev => prev + 1);
  const handleResetToToday = () => {
    setWeekOffset(0);
    onDateSelect(new Date());
  };

  return (
    <div className="bg-white p-4 md:p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
      
      {/* Header & Navigation */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
            <Calendar className="w-4 h-4" />
          </div>
          <h3 className="text-slate-800 font-bold text-lg tracking-tight">Timeline</h3>
        </div>

        {/* Week Navigation Controls */}
        <div className="flex items-center gap-0.5 bg-slate-50 p-1 rounded-lg border border-slate-200/60 w-full sm:w-auto justify-between sm:justify-start shadow-inner">
          <button 
            onClick={handlePrevWeek}
            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-indigo-600 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-200"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <button 
            onClick={handleResetToToday}
            className="px-3 py-1 text-[10px] font-bold text-slate-600 uppercase tracking-widest hover:text-indigo-600 transition-colors"
          >
            Today
          </button>
          
          <button 
            onClick={handleNextWeek}
            className="p-1.5 hover:bg-white hover:shadow-sm rounded-md text-slate-500 hover:text-indigo-600 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-200"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((date) => {
          const selected = isSameDay(date, selectedDate);
          const today = isToday(date);
          
          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={`relative flex flex-col items-center p-2 sm:py-2.5 rounded-xl transition-all duration-200 group ${
                selected 
                  ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white scale-105 shadow-sm shadow-indigo-200 ring-2 ring-indigo-50 z-10' 
                  : today
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-100 hover:bg-indigo-100'
                    : 'bg-slate-50 text-slate-500 border border-slate-100 hover:border-slate-300 hover:bg-white'
              }`}
            >
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5 ${
                selected ? 'opacity-90' : 'opacity-60'
              }`}>
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
              
              <span className="text-base sm:text-lg font-black">
                {date.getDate()}
              </span>

              {/* Today Indicator Dot */}
              {today && (
                <span className={`absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full ${
                  selected ? 'bg-white' : 'bg-indigo-500 animate-pulse'
                }`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}