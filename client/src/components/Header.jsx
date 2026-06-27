import React from 'react';
import { LayoutDashboard } from 'lucide-react';
import { Link } from 'react-router-dom'; 

const Header = () => {
  return (
    <nav className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto bg-white border-b border-gray-100">
      
      {/* Logo Section */}
      <Link to="/" className="flex items-center gap-3 group">
        <div className="bg-blue-600 p-2 rounded-xl group-hover:bg-blue-700 transition-colors">
          <LayoutDashboard className="text-white" size={24} />
        </div>
        <span className="text-xl font-bold tracking-tight text-gray-900">
          Remind Me
        </span>
      </Link>
    
      {/* Call to Action */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Login Link - Styled as a subtle secondary action */}
        <Link 
          to="/login" 
          className="text-gray-600 hover:text-gray-900 px-4 py-2.5 text-sm font-semibold transition-colors"
        >
          Log in
        </Link>
        
        {/* Register Link - Styled as the primary action */}
        <Link 
          to="/register" 
          className="bg-gray-900 text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-gray-800 transition-all shadow-sm"
        >
          Get Started
        </Link>
      </div>
      
    </nav>
  );
};

export default Header;