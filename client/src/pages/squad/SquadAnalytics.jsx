import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Loader2, Trophy, BarChart3, CalendarDays, 
  Filter, ChevronLeft, ChevronRight, Activity, Medal 
} from 'lucide-react';
import api from '../../utils/api'; 

export default function SquadAnalytics() {
  const { squadId } = useParams();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [squad, setSquad] = useState(null);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [statusOptions, setStatusOptions] = useState([]);
  
  const [activeFilter, setActiveFilter] = useState('');
  const [targetDate, setTargetDate] = useState(new Date());

  const daysInMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
  const monthDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;

  const handlePrevMonth = () => setTargetDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const handleNextMonth = () => setTargetDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));

  const now = new Date();
  const isCurrentMonth = 
    targetDate.getMonth() === now.getMonth() && 
    targetDate.getFullYear() === now.getFullYear();

  const activeDaysDenominator = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        const squadRes = await api.get(`/squads/${squadId}`);
        setSquad(squadRes.data);
        
        const options = squadRes.data.status_options || [];
        setStatusOptions(options);
        
        if (options.length > 0 && !activeFilter) {
          setActiveFilter(options[0].label);
        }

        const analyticsRes = await api.get(`/squads/${squadId}/analytics`, {
          params: { month: monthStr }
        });
        
        setAnalyticsData(analyticsRes.data.member_stats || []);
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (squadId) fetchAnalytics();
  }, [squadId, monthStr, activeFilter]); 

  const sortedLeaderboard = [...analyticsData].sort((a, b) => {
    const countA = a.counts[activeFilter] || 0;
    const countB = b.counts[activeFilter] || 0;
    
    if (countB !== countA) return countB - countA; 
    
    const totalLogsA = Object.keys(a.logs || {}).length;
    const totalLogsB = Object.keys(b.logs || {}).length;
    return totalLogsB - totalLogsA;
  });

  const vibeCounts = {};
  let totalLogs = 0;
  
  analyticsData.forEach(stat => {
    Object.values(stat.logs || {}).forEach(log => {
      if (log && log.label) {
        vibeCounts[log.label] = (vibeCounts[log.label] || 0) + 1;
        totalLogs++;
      }
    });
  });

  const vibeColors = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-violet-500'];
  
  const vibeDistribution = Object.entries(vibeCounts)
    .map(([label, count], index) => {
      const option = statusOptions.find(opt => opt.label === label);
      return {
        label, count,
        percentage: totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0,
        emoji: option ? option.emoji : '·',
        colorClass: vibeColors[index % vibeColors.length]
      };
    })
    .sort((a, b) => b.percentage - a.percentage); 

  if (isLoading && !squad) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center text-zinc-500 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-800" />
        <span className="text-sm font-medium tracking-wide">Crunching the numbers...</span>
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-200 text-center max-w-sm">
          <p className="text-zinc-500 font-medium mb-4">Failed to load squad data.</p>
          <button onClick={() => navigate(-1)} className="px-6 py-2 bg-zinc-900 text-white rounded-full text-sm font-medium hover:bg-zinc-800 transition-colors">
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-900 p-4 sm:p-6 md:p-8 font-sans selection:bg-zinc-200">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="group flex items-center gap-2 text-sm font-medium text-zinc-500 hover:text-zinc-900 transition-colors mb-6"
            >
              <span className="p-1.5 rounded-full bg-zinc-100 group-hover:bg-zinc-200 transition-colors">
                <ArrowLeft className="w-4 h-4" /> 
              </span>
              Back to Squad
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-zinc-900" />
              Squad Analytics
            </h1>
          </div>

          <div className="flex items-center bg-white rounded-xl shadow-sm border border-zinc-200/80 p-1.5 w-full md:w-auto">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-zinc-900 transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 font-semibold text-sm text-zinc-800 min-w-[140px] justify-center px-4">
              <CalendarDays className="w-4 h-4 text-zinc-400" />
              {targetDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            </div>

            <button 
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              className={`p-2 rounded-lg transition-all ${
                isCurrentMonth 
                  ? 'text-zinc-300 cursor-not-allowed' 
                  : 'hover:bg-zinc-100 text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading && squad && (
          <div className="fixed bottom-8 right-8 z-50">
             <div className="bg-zinc-900/90 backdrop-blur-sm px-4 py-2.5 rounded-full shadow-lg flex items-center gap-2 text-white text-sm font-medium animate-pulse">
               <Loader2 className="w-4 h-4 animate-spin" /> Syncing data...
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Squad Vibe Check */}
          <div className={`col-span-1 bg-white p-6 rounded-3xl border border-zinc-200/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] transition-opacity duration-200 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 bg-zinc-100 rounded-xl">
                <Activity className="w-5 h-5 text-zinc-800" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Vibe Check</h2>
                <p className="text-xs text-zinc-500 mt-0.5">Overall status distribution</p>
              </div>
            </div>
            
            {totalLogs > 0 ? (
              <div className="space-y-6">
                <div className="flex w-full h-4 rounded-full overflow-hidden bg-zinc-100">
                  {vibeDistribution.map((vibe) => (
                    <div 
                      key={vibe.label}
                      className={`h-full ${vibe.colorClass} border-r-2 border-white last:border-0`}
                      style={{ width: `${vibe.percentage}%` }}
                      title={`${vibe.label} (${vibe.percentage}%)`}
                    />
                  ))}
                </div>
                
                <div className="flex flex-col gap-3">
                  {vibeDistribution.map((vibe) => (
                    <div key={vibe.label} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <span className={`w-3 h-3 rounded-full shadow-sm ${vibe.colorClass}`}></span>
                        <span className="font-medium text-zinc-700">{vibe.emoji} {vibe.label}</span>
                      </div>
                      <span className="text-zinc-500 font-semibold">{vibe.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-zinc-50 rounded-2xl border border-zinc-100 border-dashed">
                <span className="text-2xl mb-2">👻</span>
                <p className="text-zinc-500 text-sm font-medium">It's a ghost town.<br/>No statuses logged yet.</p>
              </div>
            )}
          </div>

          {/* Leaderboard Section */}
          <div className={`col-span-1 lg:col-span-2 bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] transition-opacity duration-200 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
              <div className="flex items-center gap-3 shrink-0">
                <div className="p-2 bg-amber-100/50 rounded-xl">
                  <Trophy className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900">Leaderboard</h2>
              </div>

              {/* FIX 2: Added universal Tailwind classes to hide the scrollbar without a plugin */}
              <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1 sm:pb-0 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                <span className="pl-1 pr-2 text-zinc-400 shrink-0"><Filter className="w-4 h-4" /></span>
                {statusOptions.map(opt => (
                  <button
                    key={opt.label}
                    onClick={() => setActiveFilter(opt.label)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all whitespace-nowrap shrink-0 ${
                      activeFilter === opt.label 
                        ? 'bg-zinc-900 text-white shadow-md' 
                        : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200/80'
                    }`}
                  >
                    <span>{opt.emoji}</span> {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {sortedLeaderboard.map((stat, index) => {
                const loggedDaysCount = Object.keys(stat.logs || {}).length;
                const consistency = Math.min(100, Math.round((loggedDaysCount / activeDaysDenominator) * 100));
                
                let consistencyColor = "bg-zinc-300";
                if (consistency >= 80) consistencyColor = "bg-emerald-500";
                else if (consistency >= 40) consistencyColor = "bg-amber-500";

                const isFirst = index === 0;
                const isSecond = index === 1;
                const isThird = index === 2;

                return (
                  <div 
                    key={stat.member.id} 
                    className={`group relative flex flex-col p-5 bg-white rounded-2xl border transition-all duration-300 hover:shadow-md ${
                      isFirst ? 'border-amber-200 shadow-[0_0_15px_-3px_rgba(251,191,36,0.15)] ring-1 ring-amber-100' : 'border-zinc-200/80'
                    }`}
                  >
                    {/* FIX 1: Added gap-3, flex-1, and min-w-0 to properly contain and truncate the name text */}
                    <div className="flex items-center justify-between mb-6 gap-3">
                      
                      {/* Left Side Container (Avatar + Name) */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          isFirst ? 'bg-amber-100 text-amber-700' : 
                          isSecond ? 'bg-slate-100 text-slate-700' : 
                          isThird ? 'bg-orange-50 text-orange-700' : 
                          'bg-zinc-100 text-zinc-600'
                        }`}>
                          {stat.member.name.substring(0, 2).toUpperCase()}
                          
                          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white ${
                            isFirst ? 'bg-amber-400 text-white' : 
                            isSecond ? 'bg-slate-300 text-slate-700' : 
                            isThird ? 'bg-orange-300 text-orange-800' : 
                            'bg-zinc-200 text-zinc-600'
                          }`}>
                            {index + 1}
                          </div>
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-zinc-900 truncate text-base" title={stat.member.name}>
                            {stat.member.name}
                          </h4>
                          <p className="text-xs text-zinc-500 flex items-center gap-1">
                            {isFirst && <Medal className="w-3 h-3 text-amber-500" />}
                            Rank #{index + 1}
                          </p>
                        </div>
                      </div>

                      {/* Right Side Container (Hits) - Added shrink-0 */}
                      <div className="text-right shrink-0">
                        <div className="text-2xl font-black text-zinc-900 tracking-tight">
                          {stat.counts[activeFilter] || 0}
                        </div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest truncate">
                          Hits
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto pt-4 border-t border-zinc-100">
                      <div className="flex justify-between items-center text-xs text-zinc-500 mb-2 font-medium">
                        <span>Consistency</span>
                        <span className="text-zinc-900 font-bold">{consistency}%</span>
                      </div>
                      <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${consistencyColor} transition-all duration-1000 ease-out`} 
                          style={{ width: `${consistency}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Monthly Heatmap */}
        <div className={`bg-white p-6 sm:p-8 rounded-3xl border border-zinc-200/80 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.03)] overflow-hidden transition-opacity duration-200 ${isLoading ? 'opacity-60' : 'opacity-100'}`}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-zinc-900">Activity Heatmap</h2>
            <div className="text-sm font-medium text-zinc-400 bg-zinc-50 px-3 py-1.5 rounded-full">
              {monthDays.length} Days
            </div>
          </div>
          
          <div className="overflow-x-auto pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div className="min-w-fit">
              <div className="flex mb-3 sticky top-0 z-10 pb-3 border-b border-zinc-100">
                <div className="w-14 flex-shrink-0 text-left text-xs font-bold text-zinc-400 uppercase tracking-wider flex items-end pb-1">
                  Day
                </div>
                {analyticsData.map(stat => (
                  <div key={stat.member.id} className="w-16 sm:w-20 flex-shrink-0 flex flex-col items-center gap-1">
                    <div className="w-8 h-8 bg-zinc-100 text-zinc-600 rounded-full flex items-center justify-center text-xs font-bold mb-1">
                      {stat.member.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-semibold text-zinc-700 truncate w-full text-center px-1" title={stat.member.name}>
                      {stat.member.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                {monthDays.map(day => (
                  <div key={day} className="flex items-center hover:bg-zinc-50/80 rounded-xl p-1.5 transition-colors group">
                    <div className="w-14 flex-shrink-0 text-sm font-semibold text-zinc-400 group-hover:text-zinc-800 transition-colors">
                      {String(day).padStart(2, '0')}
                    </div>
                    
                    {analyticsData.map(stat => {
                      const dayLog = stat.logs[String(day)];
                      
                      return (
                        <div key={stat.member.id} className="w-16 sm:w-20 flex-shrink-0 flex justify-center">
                          <div 
                            className={`w-10 h-10 rounded-2xl border flex items-center justify-center text-lg transition-all duration-200 ${
                              dayLog 
                                ? 'bg-white border-zinc-200 shadow-sm hover:scale-105 hover:shadow-md cursor-pointer' 
                                : 'bg-zinc-50/50 border-transparent text-zinc-300'
                            }`}
                            title={`${stat.member.name} - Day ${day}: ${dayLog ? dayLog.label : 'No update'}`}
                          >
                            <span>
                              {dayLog ? dayLog.emoji : <span className="opacity-50 text-sm">·</span>}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
}