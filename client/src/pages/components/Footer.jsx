import React from 'react';
import { Link } from 'react-router-dom';
import { LayoutDashboard } from 'lucide-react';

const links = [
  { to: '/about', label: 'About' },
  { to: '/faqs', label: 'FAQs' },
  { to: '/terms', label: 'Terms' },
];

const Footer = () => {
  return (
    <footer className="bg-[#F6FAFF] border-t border-sky-100 pt-10 pb-8 px-6 text-sm antialiased">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
        {/* Brand Section */}
        <div className="flex flex-col items-center sm:items-start">
          <Link
            to="/"
            className="flex items-center gap-2.5 mb-3 group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 transition-transform group-hover:-translate-y-0.5">
              <LayoutDashboard size={19} strokeWidth={2.5} />
            </span>
            <span className="text-[19px] font-extrabold tracking-tight text-slate-800">
              Remind<span className="text-blue-600">Me</span>
            </span>
          </Link>
          <p className="text-slate-500 text-center sm:text-left max-w-xs leading-relaxed">
            The simple, smart way to track your tasks and free up your mental space.
          </p>
        </div>

        {/* Links & Copyright */}
        <div className="flex flex-col items-center sm:items-end gap-4">
          <nav aria-label="Footer" className="flex gap-2 font-semibold text-slate-600">
            {links.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                className="px-3 py-1.5 rounded-full hover:bg-blue-50 hover:text-blue-700 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {label}
              </Link>
            ))}
          </nav>
          <p className="text-slate-400">
            © {new Date().getFullYear()} RemindMe. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;