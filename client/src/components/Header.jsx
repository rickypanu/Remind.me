import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Plus, BarChart3, Users, CircleUser } from 'lucide-react';
import { Link } from 'react-router-dom'; 
import api from '../utils/api'; 

const Header = () => {
  // Check auth state
  const isLoggedIn = !!localStorage.getItem("token");
  
  // Avatar URL state
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (isLoggedIn) {
      api.get("/user/me")
        .then((response) => {
          if (response.data.avatar_url) {
            setAvatarUrl(response.data.avatar_url);
          }
        })
        .catch((error) => {
          console.error("Failed to fetch user data for header", error);
        });
    }
  }, [isLoggedIn]);

  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-black/[0.06] antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 max-w-5xl mx-auto">
        
        {/* Apple-Style Branding */}
        <Link 
          to={isLoggedIn ? "/dashboard" : "/"} 
          className="flex items-center gap-2 group select-none active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-[0_2px_8px_rgba(37,99,235,0.25)] transition-all group-hover:bg-blue-700">
            <LayoutDashboard size={18} strokeWidth={2.2} />
          </div>
          <span className="text-base font-semibold tracking-tight text-slate-900">
            Remind<span className="text-blue-600 font-bold">Me</span>
          </span>
        </Link>
      
        {/* Navigation & Actions */}
        <div className="flex items-center gap-1 sm:gap-2">
          {!isLoggedIn ? (
            <>
              {/* Logged Out Actions */}
              <Link 
                to="/login" 
                className="text-slate-600 hover:text-slate-900 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg hover:bg-slate-100/60 transition-colors"
              >
                Log in
              </Link>
              <Link 
                to="/register" 
                className="bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all active:scale-[0.97] shadow-sm"
              >
                Get Started
              </Link>
            </>
          ) : (
            <>
              {/* Logged In Features */}
              <div className="flex items-center gap-0.5 sm:gap-1">
                <Link
                  to="/squad"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 text-xs sm:text-sm font-medium transition-all active:scale-[0.97]"
                  title="Squad"
                >
                  <Users size={17} strokeWidth={2} className="text-slate-500" />
                  <span className="hidden md:inline">Squad</span>
                </Link>

                <Link
                  to="/reminder/report"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 text-xs sm:text-sm font-medium transition-all active:scale-[0.97]"
                  title="Weekly Report"
                >
                  <BarChart3 size={17} strokeWidth={2} className="text-slate-500" />
                  <span className="hidden md:inline">Report</span>
                </Link>
              </div>

              {/* iOS Primary Action */}
              <Link
                to="/create-task"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-full text-xs sm:text-sm font-medium shadow-[0_1px_3px_rgba(37,99,235,0.3)] active:scale-[0.97] transition-all ml-1"
                title="New Reminder"
              >
                <Plus size={16} strokeWidth={2.5} />
                <span className="hidden md:inline">New Reminder</span>
              </Link>

              {/* Subtle Native Separator */}
              <div className="h-4 w-px bg-slate-200/80 mx-1 sm:mx-1.5"></div>

              {/* Profile Avatar */}
              <Link
                to="/profile"
                className="flex items-center justify-center p-0.5 rounded-full text-slate-400 hover:text-slate-700 active:scale-[0.95] transition-all"
                title="Profile Settings"
              >
                {avatarUrl ? (
                  <img 
                    src={avatarUrl.startsWith("/uploads") 
                      ? `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "")}${avatarUrl}` 
                      : avatarUrl
                    } 
                    alt="User Profile" 
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-black/10 shadow-sm"
                  />
                ) : (
                  <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 ring-1 ring-black/5">
                    <CircleUser size={20} strokeWidth={1.8} />
                  </div>
                )}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Header;