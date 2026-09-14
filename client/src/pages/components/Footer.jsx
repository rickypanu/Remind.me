import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-100 pt-8 pb-8 px-6 text-sm">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
        
        {/* Brand Section */}
        <div className="flex flex-col items-center sm:items-start">
          <Link to="/" className="flex items-center gap-2 mb-2 group">
             <div className="bg-blue-600 p-1.5 rounded-lg group-hover:bg-blue-700 transition-colors">
               <LayoutDashboard className="text-white" size={18} />
             </div>
             <span className="text-lg font-bold tracking-tight text-gray-900">
               Remind Me
             </span>
          </Link>
          <p className="text-gray-500 text-center sm:text-left max-w-xs">
            The simple, smart way to track your tasks and free up your mental space.
          </p>
        </div>

        {/* Links & Copyright */}
        <div className="flex flex-col items-center sm:items-end gap-3">
          <div className="flex gap-6 text-gray-500 font-medium">
            <Link to="/faqs" className="hover:text-blue-600 transition-colors">FAQs</Link>
            <Link to="/terms" className="hover:text-blue-600 transition-colors">Terms</Link>
          </div>
          <div className="text-gray-400">
            <p>© {new Date().getFullYear()} Remind Me. All rights reserved.</p>
          </div>
        </div>
        
      </div>
    </footer>
  );
};

export default Footer;