import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Trophy, BarChart3, CalendarDays, Filter, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
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

  const handlePrevMonth = () => {
    setTargetDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setTargetDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const isCurrentMonth = 
    targetDate.getMonth() === new Date().getMonth() && 
    targetDate.getFullYear() === new Date().getFullYear();

  // FIXED: Determine the correct denominator for consistency math
  const now = new Date();
  const activeDaysDenominator = isCurrentMonth ? now.getDate() : daysInMonth;

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

  // --- DERIVED METRICS ---

  const sortedLeaderboard = [...analyticsData].sort((a, b) => {
    const countA = a.counts[activeFilter] || 0;
    const countB = b.counts[activeFilter] || 0;
    return countB - countA; 
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

  const vibeColors = ['bg-indigo-500', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400', 'bg-cyan-400', 'bg-purple-400'];
  
  const vibeDistribution = Object.entries(vibeCounts)
    .map(([label, count], index) => {
      const option = statusOptions.find(opt => opt.label === label);
      return {
        label,
        count,
        percentage: totalLogs > 0 ? Math.round((count / totalLogs) * 100) : 0,
        emoji: option ? option.emoji : '·',
        colorClass: vibeColors[index % vibeColors.length]
      };
    })
    .sort((a, b) => b.percentage - a.percentage); 

  // --- RENDER ---

  if (isLoading && !squad) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center text-gray-500 gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-gray-900" />
        <span className="text-sm font-medium tracking-wide">Crunching the numbers...</span>
      </div>
    );
  }

  if (!squad) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <p className="text-gray-500 font-medium">Failed to load squad data.</p>
        <button onClick={() => navigate(-1)} className="mt-4 text-gray-900 font-bold hover:underline">Go Back</button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-gray-200">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" /> 
              Back 
            </button>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-gray-900" />
              Squad Analytics
            </h1>
          </div>

          <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1 w-full md:w-auto">
            <button 
              onClick={handlePrevMonth}
              className="p-2 hover:bg-gray-50 rounded-md text-gray-500 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-2 font-medium text-sm text-gray-700 min-w-[140px] justify-center px-4 border-x border-gray-100">
              <CalendarDays className="w-4 h-4 text-gray-400" />
              {targetDate.toLocaleString('default', { month: 'short', year: 'numeric' })}
            </div>

            <button 
              onClick={handleNextMonth}
              disabled={isCurrentMonth}
              className={`p-2 rounded-md transition-colors ${
                isCurrentMonth 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : 'hover:bg-gray-50 text-gray-500 hover:text-gray-900'
              }`}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isLoading && squad && (
          <div className="flex justify-center py-2">
             <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm flex items-center gap-2 text-gray-600 text-sm font-medium">
               <Loader2 className="w-4 h-4 animate-spin" /> Updating...
             </div>
          </div>
        )}

        {/* Squad Vibe Check */}
        <div className={`bg-white p-6 rounded-2xl border border-gray-200 transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
          <div className="flex items-center gap-3 mb-6">
            <Activity className="w-5 h-5 text-gray-800" />
            <div>
              <h2 className="text-lg font-bold text-gray-900">Squad Vibe Check</h2>
              <p className="text-xs text-gray-500 mt-0.5">Overall status distribution this month</p>
            </div>
          </div>
          
          {totalLogs > 0 ? (
            <div className="space-y-4">
              <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100">
                {vibeDistribution.map((vibe) => (
                  <div 
                    key={vibe.label}
                    className={`h-full ${vibe.colorClass} border-r border-white/20 last:border-0`}
                    style={{ width: `${vibe.percentage}%` }}
                    title={`${vibe.label} (${vibe.percentage}%)`}
                  />
                ))}
              </div>
              
              <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2">
                {vibeDistribution.map((vibe) => (
                  <div key={vibe.label} className="flex items-center gap-2 text-sm">
                    <span className={`w-2.5 h-2.5 rounded-full ${vibe.colorClass}`}></span>
                    <span className="font-medium text-gray-700">{vibe.emoji} {vibe.label}</span>
                    <span className="text-gray-400 font-semibold">{vibe.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm font-medium bg-gray-50 rounded-xl border border-gray-100">
              No statuses logged yet this month.
            </div>
          )}
        </div>

        {/* Leaderboard Section */}
        <div className={`bg-white p-6 rounded-2xl border border-gray-200 transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Trophy className="w-6 h-6 text-gray-800" />
              <h2 className="text-xl font-bold text-gray-900">Leaderboard</h2>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-2 sm:pb-0">
              <span className="pl-1 pr-2 text-gray-400"><Filter className="w-4 h-4" /></span>
              {statusOptions.map(opt => (
                <button
                  key={opt.label}
                  onClick={() => setActiveFilter(opt.label)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    activeFilter === opt.label 
                      ? 'bg-gray-900 text-white' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  <span>{opt.emoji}</span> {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sortedLeaderboard.map((stat, index) => {
              
              // FIXED: Calculate consistency against elapsed days, capped at 100%
              const loggedDaysCount = Object.keys(stat.logs || {}).length;
              const consistency = Math.min(100, Math.round((loggedDaysCount / activeDaysDenominator) * 100));
              
              let consistencyColor = "bg-gray-400";
              if (consistency >= 80) consistencyColor = "bg-green-500";
              else if (consistency >= 40) consistencyColor = "bg-amber-400";

              return (
                <div key={stat.member.id} className="flex flex-col p-4 bg-gray-50 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xs shrink-0">
                        {stat.member.name.substring(0, 3).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-gray-900 flex items-center gap-2 truncate text-sm">
                          {stat.member.name}
                          {index === 0 && <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full font-medium shrink-0">1st</span>}
                        </h4>
                        <p className="text-xs text-gray-500">Rank #{index + 1}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-bold text-gray-900">
                        {stat.counts[activeFilter] || 0}
                      </div>
                      <div className="text-[10px] text-gray-500 uppercase tracking-wide truncate max-w-[60px]">
                        {activeFilter}
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-gray-200/60">
                    <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1.5 font-semibold uppercase tracking-wider">
                      <span>Consistency</span>
                      <span className="text-gray-900">{consistency}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div 
                        className={`h-1.5 rounded-full ${consistencyColor} transition-all duration-500`} 
                        style={{ width: `${consistency}%` }}
                      ></div>
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        </div>

        {/* Monthly Heatmap */}
        <div className={`bg-white p-6 rounded-2xl border border-gray-200 overflow-hidden transition-opacity duration-200 ${isLoading ? 'opacity-50' : 'opacity-100'}`}>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Monthly Overview</h2>
          
          <div className="overflow-x-auto pb-2">
            <div className="min-w-fit">
              
              <div className="flex mb-2 sticky top-0 bg-white z-10 pb-2 border-b border-gray-100">
                <div className="w-12 flex-shrink-0 text-left text-xs font-semibold text-gray-400 flex items-end pb-1">
                  Day
                </div>
                {analyticsData.map(stat => (
                  <div key={stat.member.id} className="w-16 sm:w-20 flex-shrink-0 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium text-gray-700 truncate w-full text-center px-1">
                      {stat.member.name.split(' ')[0]}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1">
                {monthDays.map(day => (
                  <div key={day} className="flex items-center hover:bg-gray-50 rounded-md p-1 transition-colors">
                    <div className="w-12 flex-shrink-0 text-sm font-medium text-gray-500">
                      {day}
                    </div>
                    
                    {analyticsData.map(stat => {
                      const dayLog = stat.logs[String(day)];
                      
                      return (
                        <div key={stat.member.id} className="w-16 sm:w-20 flex-shrink-0 flex justify-center">
                          <div 
                            className="w-8 h-8 rounded-md border flex items-center justify-center text-sm transition-all"
                            style={{ 
                              backgroundColor: dayLog ? '#ffffff' : '#f9fafb',
                              borderColor: dayLog ? '#d1d5db' : '#f3f4f6',
                            }}
                            title={`${stat.member.name} - Day ${day}: ${dayLog ? dayLog.label : 'No update'}`}
                          >
                            <span>
                              {dayLog ? dayLog.emoji : <span className="text-gray-300">·</span>}
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