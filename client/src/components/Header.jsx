import React, { useState, useEffect } from 'react';
import { LayoutDashboard, Plus, BarChart3, Users, CircleUser } from 'lucide-react';
import { Link } from 'react-router-dom'; 
import api from '../utils/api'; 

const Header = () => {
  // Simple check to see if the user is logged in
  const isLoggedIn = !!localStorage.getItem("token");
  
  // State to hold the user's avatar URL
  const [avatarUrl, setAvatarUrl] = useState(null);

  // Fetch the user's profile data if they are logged in
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
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 max-w-7xl mx-auto">
        
        {/* Logo Section */}
        <Link to={isLoggedIn ? "/dashboard" : "/"} className="flex items-center gap-2 sm:gap-3 group">
          <div className="bg-blue-600 p-1.5 sm:p-2 rounded-xl group-hover:bg-blue-700 transition-colors">
            <LayoutDashboard className="text-white" size={22} />
          </div>
          <span className="text-lg sm:text-xl font-black tracking-tight text-gray-900">
            Remind<span className="text-blue-600">Me</span>
          </span>
        </Link>
      
        {/* Dynamic Actions based on Auth State */}
        <div className="flex items-center gap-2 sm:gap-4">
          {!isLoggedIn ? (
            <>
              {/* Logged Out State */}
              <Link 
                to="/login" 
                className="text-gray-600 hover:text-gray-900 px-3 sm:px-4 py-2 sm:py-2.5 text-sm font-semibold transition-colors"
              >
                Log in
              </Link>
              <Link 
                to="/register" 
                className="bg-gray-900 text-white px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition-all shadow-sm"
              >
                Get Started
              </Link>
            </>
          ) : (
            <>
              {/* Logged In State */}
              
              {/* 1. Standard Navigation Group */}
              <Link
                to="/squad"
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-blue-50 font-bold transition-all"
                title="Squad"
              >
                <Users size={20} strokeWidth={2.5} />
                <span className="hidden md:inline text-sm">Squad</span>
              </Link>

              <Link
                to="/reminder/report"
                className="flex items-center gap-1.5 p-2 sm:px-3 sm:py-2 rounded-xl text-gray-600 hover:text-blue-600 hover:bg-blue-50 font-bold transition-all"
                title="Weekly Reminder Report"
              >
                <BarChart3 size={20} strokeWidth={2.5} />
                <span className="hidden md:inline text-sm">Report</span>
              </Link>

              {/* 2. Primary Call To Action */}
              <Link
                to="/create-task"
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white p-2 sm:px-4 sm:py-2 rounded-xl font-bold shadow-md shadow-blue-500/20 active:scale-95 transition-all ml-1"
                title="New Reminder"
              >
                <Plus size={20} strokeWidth={3} />
                <span className="hidden md:inline text-sm">New Reminder</span>
              </Link>

              {/* 3. Divider connecting app features from account features */}
              <div className="h-6 w-px bg-gray-200 mx-1 sm:mx-2"></div>

              {/* 4. Profile / Account Settings */}
              <Link
                to="/profile"
                className="flex items-center justify-center p-1 rounded-full text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-all overflow-hidden"
                title="Profile"
              >
                {/* CONDITIONAL RENDER: Image if exists, Icon if null */}
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="User Profile" 
                    className="h-7 w-7 sm:h-8 sm:w-8 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <CircleUser size={26} strokeWidth={2} />
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