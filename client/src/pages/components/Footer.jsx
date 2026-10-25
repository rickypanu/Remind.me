import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone } from 'lucide-react';
import Logo from '../../components/Logo';
import { SITE, mailto, telHref } from '../../config/site';

const links = [
  { to: '/about', label: 'About' },
  { to: '/faqs', label: 'FAQs' },
  { to: '/terms', label: 'Terms & Privacy' },
];

const Footer = () => {
  return (
    <footer className="bg-[color:var(--rm-page)] border-t border-sky-100 pt-10 pb-8 px-4 sm:px-6 text-sm antialiased">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center sm:items-start justify-between gap-8">
        {/* Brand Section */}
        <div className="flex flex-col items-center sm:items-start min-w-0">
          <Logo className="mb-3" />
          <p className="text-slate-500 text-center sm:text-left max-w-xs leading-relaxed">
            Specific, daily and weekly reminders, delivered to Telegram and your browser.
          </p>
          <div className="mt-4 flex flex-col items-center sm:items-start gap-2 font-medium text-slate-600">
            <a
              href={mailto('RemindMe support')}
              className="inline-flex items-center gap-2 break-all hover:text-blue-700 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <Mail size={16} className="shrink-0" /> {SITE.supportEmail}
            </a>
            {SITE.supportPhone && (
              <a
                href={telHref(SITE.supportPhone)}
                className="inline-flex items-center gap-2 hover:text-blue-700 transition-colors rounded outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <Phone size={16} className="shrink-0" /> {SITE.supportPhone}
              </a>
            )}
          </div>
        </div>

        {/* Links & Copyright */}
        <div className="flex flex-col items-center sm:items-end gap-4">
          <nav aria-label="Footer" className="flex flex-wrap justify-center sm:justify-end gap-2 font-semibold text-slate-600">
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
          <p className="text-slate-500 text-center sm:text-right">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
