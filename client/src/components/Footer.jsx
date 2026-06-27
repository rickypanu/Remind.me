import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-100 pt-12 pb-8 px-6 text-sm">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
        
        {/* Brand Column */}
        <div className="md:col-span-2">
          <Link to="/" className="flex items-center gap-2 mb-4 group">
             <div className="bg-blue-600 p-1.5 rounded-lg group-hover:bg-blue-700 transition-colors">
               <LayoutDashboard className="text-white" size={18} />
             </div>
             <span className="text-lg font-bold tracking-tight text-gray-900">
               Remind Me
             </span>
          </Link>
          <p className="text-gray-500 max-w-xs">
            The simple, smart way to track your tasks and free up your mental space.
          </p>
        </div>

        {/* Links Column 1 */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Product</h3>
          <ul className="flex flex-col gap-3 text-gray-500">
            <li><a href="#features" className="hover:text-blue-600 transition-colors">Features</a></li>
            <li><a href="#how-it-works" className="hover:text-blue-600 transition-colors">How It Works</a></li>
          </ul>
        </div>

        {/* Links Column 2 */}
        <div>
          <h3 className="font-semibold text-gray-900 mb-4">Legal</h3>
          <ul className="flex flex-col gap-3 text-gray-500">
            <li><Link to="/privacy" className="hover:text-blue-600 transition-colors">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-blue-600 transition-colors">Terms of Service</Link></li>
            <li><a href="mailto:hello@remindme.com" className="hover:text-blue-600 transition-colors">Contact Us</a></li>
          </ul>
        </div>
        
      </div>

      {/* Bottom Copyright */}
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-gray-100 text-gray-400">
        <p>© {new Date().getFullYear()} Remind Me. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;