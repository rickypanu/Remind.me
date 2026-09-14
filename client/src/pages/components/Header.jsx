import React, { useState, useEffect } from 'react';
import { Bell, LayoutDashboard, Plus, CircleUser } from 'lucide-react';
import { Link } from 'react-router-dom'; 
import api from '../../utils/api'; 

const Header = () => {
  const isLoggedIn = !!localStorage.getItem("token");
  const [avatarUrl, setAvatarUrl] = useState(null);

  useEffect(() => {
    if (isLoggedIn) {
      api.get("/user/me")
        .then(({ data }) => {
          if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        })
        .catch((error) => console.error("Failed to fetch user data for header", error));
    }
  }, [isLoggedIn]);

  const getAvatarSrc = () => avatarUrl.startsWith("/uploads") 
    ? `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "")}${avatarUrl}` 
    : avatarUrl;

  return (
    <nav className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/50 antialiased font-[-apple-system,BlinkMacSystemFont,'SF_Pro_Text','SF_Pro_Display','Helvetica_Neue',sans-serif]">
      <div className="flex items-center justify-between px-4 sm:px-6 h-14 max-w-5xl mx-auto">
        
        {/* Brand Logo */}
        <Link 
          to={isLoggedIn ? "/dashboard" : "/"} 
          className="flex items-center gap-2.5 group select-none active:scale-[0.98] transition-transform"
        >
          <div className="w-8 h-8 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-sm transition-all group-hover:bg-blue-600">
            <LayoutDashboard size={18} strokeWidth={2.5} />
          </div>
          <span className="text-[17px] font-bold tracking-tight text-gray-900">
            Remind<span className="text-blue-500">Me</span>
          </span>
        </Link>
      
        {/* Navigation & Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          {!isLoggedIn ? (
            <>
              <Link to="/login" className="text-gray-500 hover:text-gray-900 px-3 py-1.5 text-[15px] font-medium rounded-xl hover:bg-gray-100/60 transition-colors">
                Log in
              </Link>
              <Link to="/register" className="bg-gray-900 hover:bg-black text-white px-4 py-1.5 rounded-full text-[15px] font-medium transition-all active:scale-[0.97] shadow-sm">
                Get Started
              </Link>
            </>
          ) : (
            <>
              {/* Secondary Action */}
             <Link
                to="/telegram-setup"
                className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-1.5 rounded-full text-[13px] sm:text-[14px] font-medium active:scale-[0.97] transition-all"
              >
                <Bell size={16} strokeWidth={2.5} className="text-gray-500" />
                <span className="hidden md:inline">Notification</span>
              </Link>

              {/* Primary Action */}
              <Link
                to="/create-task"
                className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-full text-[13px] sm:text-[14px] font-semibold shadow-sm active:scale-[0.97] transition-all"
              >
                <Plus size={16} strokeWidth={3} />
                <span className="hidden md:inline">New Reminder</span>
              </Link>

              {/* Separator */}
              <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>

              {/* Profile Avatar */}
              <Link
                to="/profile"
                className="flex items-center justify-center p-0.5 rounded-full text-gray-400 hover:text-gray-700 active:scale-[0.95] transition-all"
              >
                {avatarUrl ? (
                  <img 
                    src={getAvatarSrc()} 
                    alt="User Profile" 
                    className="h-[28px] w-[28px] rounded-full object-cover ring-1 ring-gray-200 shadow-sm"
                  />
                ) : (
                  <div className="h-[28px] w-[28px] rounded-full bg-gray-100 flex items-center justify-center text-gray-500 ring-1 ring-gray-200/50">
                    <CircleUser size={20} strokeWidth={2} />
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