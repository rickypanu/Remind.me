import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell, BellOff, BellRing, Plus, CircleUser, Loader2, Menu, X,
  LayoutDashboard, Newspaper, Info, HelpCircle, Home as HomeIcon, LogIn, UserPlus,
} from 'lucide-react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import usePush from '../../utils/usePush';
import { resolveAvatarSrc } from '../../utils/avatar';
import { isLoggedIn as hasSession } from '../../utils/auth';
import Logo from '../../components/Logo';
import ThemeToggle from '../../components/ThemeToggle';

// Links shown in the menu. Only pages that exist and are useful for that visitor.
const VISITOR_LINKS = [
  { to: '/', label: 'Home', icon: HomeIcon, end: true },
  // { to: '/about', label: 'About', icon: Info },
  // { to: '/faqs', label: 'FAQs', icon: HelpCircle },
];
const MEMBER_LINKS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/updates', label: 'Updates', icon: Newspaper },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/about', label: 'About', icon: Info },
  { to: '/faqs', label: 'FAQs', icon: HelpCircle },
];

function PushButton({ pushStatus, onClick, fullWidth = false }) {
  const base =
    'group relative flex items-center justify-center gap-2 h-10 px-3 rounded-full text-sm font-semibold active:scale-95 transition-all duration-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500';
  const tone =
    pushStatus === 'subscribed'
      ? 'bg-emerald-50 text-emerald-700 hover:bg-rose-50 hover:text-rose-600 border border-emerald-200/60 hover:border-rose-200/60'
      : pushStatus === 'loading'
      ? 'bg-slate-100 text-slate-500 cursor-not-allowed border border-transparent'
      : 'bg-white text-slate-700 border border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pushStatus === 'loading'}
      aria-pressed={pushStatus === 'subscribed'}
      aria-label={pushStatus === 'subscribed' ? 'Turn off alerts' : 'Turn on alerts'}
      className={`${base} ${tone} ${fullWidth ? 'w-full' : 'lg:px-4'}`}
    >
      {pushStatus === 'loading' && <Loader2 size={18} strokeWidth={2.5} className="animate-spin text-blue-500" />}
      {pushStatus === 'subscribed' && (
        <>
          <BellRing size={18} strokeWidth={2.5} className="block group-hover:hidden text-emerald-600" />
          <BellOff size={18} strokeWidth={2.5} className="hidden group-hover:block text-rose-500" />
        </>
      )}
      {pushStatus === 'idle' && (
        <Bell size={18} strokeWidth={2.5} className="text-slate-500 group-hover:text-blue-600 transition-colors" />
      )}
      <span className={fullWidth ? 'block' : 'hidden lg:block lg:w-[100px] text-center'}>
        {pushStatus === 'loading' ? (
          'Updating...'
        ) : pushStatus === 'subscribed' ? (
          <>
            <span className="block group-hover:hidden">Alerts on</span>
            <span className="hidden group-hover:block">Turn off</span>
          </>
        ) : (
          'Turn on alerts'
        )}
      </span>
    </button>
  );
}

const Header = () => {
  const isLoggedIn = hasSession();
  const { avatarUrl, pushStatus, toggle } = usePush(isLoggedIn);
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const menuButtonRef = useRef(null);
  const panelRef = useRef(null);

  const closeMenu = useCallback((returnFocus = false) => {
    setMenuOpen(false);
    if (returnFocus) menuButtonRef.current?.focus();
  }, []);

  // Close the menu whenever the page changes
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Menu open: Escape closes, background does not scroll, focus moves inside, wide screens auto-close
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeMenu(true);
    };
    const onResize = () => {
      if (window.matchMedia('(min-width: 768px)').matches) setMenuOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.querySelector('a,button')?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
      document.body.style.overflow = prev;
    };
  }, [menuOpen, closeMenu]);

  const getAvatarSrc = () => resolveAvatarSrc(avatarUrl);

  const links = isLoggedIn ? MEMBER_LINKS : VISITOR_LINKS;
  const desktopLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-xl text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
      isActive ? 'text-blue-700 bg-blue-50' : 'text-slate-600 hover:text-slate-900 hover:bg-blue-50'
    }`;

  return (
    <>
    <header
      className="sticky top-0 z-50 bg-[color:var(--rm-page)]/90 backdrop-blur-xl border-b border-sky-100 antialiased"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div
        className={`flex items-center justify-between gap-3 h-16 mx-auto w-full ${
          isLoggedIn ? 'max-w-6xl px-4 sm:px-6 lg:px-8' : 'max-w-7xl px-4 sm:px-6 md:px-12 lg:px-20'
        }`}
      >
        <Logo to={isLoggedIn ? '/dashboard' : '/'} />

        {/* Desktop navigation */}
        <nav aria-label="Main" className="hidden md:flex items-center gap-1 min-w-0">
          {(isLoggedIn ? [] : VISITOR_LINKS.filter((l) => l.to !== '/')).map(({ to, label }) => (
            <NavLink key={to} to={to} className={desktopLinkClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 shrink-0">
          <ThemeToggle />
          {!isLoggedIn ? (
            <>
              <Link
                to="/login"
                className="text-slate-600 hover:text-slate-900 px-4 py-2 text-sm font-semibold rounded-xl hover:bg-blue-50 transition-colors"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all active:scale-95 shadow-md shadow-blue-500/20 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                Get Started
              </Link>
            </>
          ) : (
            <>
              <PushButton pushStatus={pushStatus} onClick={toggle} />
              <Link
                to="/create-task"
                className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white w-10 h-10 lg:w-auto lg:px-4 rounded-full text-sm font-semibold shadow-md shadow-blue-500/20 active:scale-95 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                aria-label="New reminder"
              >
                <Plus size={18} strokeWidth={2.5} />
                <span className="hidden lg:block">New reminder</span>
              </Link>
              <div className="h-6 w-px bg-slate-200 mx-0.5" aria-hidden="true"></div>
              <Link
                to="/profile"
                aria-label="Your profile"
                className="flex items-center justify-center rounded-full text-slate-500 hover:text-slate-700 active:scale-95 transition-all outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 flex-shrink-0"
              >
                {avatarUrl ? (
                  <img
                    src={getAvatarSrc()}
                    alt=""
                    width="36"
                    height="36"
                    className="h-9 w-9 rounded-full object-cover ring-2 ring-white shadow-sm hover:ring-blue-200 transition-all"
                  />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-500 ring-1 ring-blue-100 hover:bg-blue-100 transition-all">
                    <CircleUser size={22} strokeWidth={2} />
                  </div>
                )}
              </Link>
            </>
          )}
        </div>

        {/* Mobile actions: theme toggle + hamburger */}
        <div className="flex md:hidden items-center gap-2 shrink-0">
          {/* Quick action: phones only (md and up already show "New reminder") */}
          {isLoggedIn && (
            <Link
              to="/create-task"
              aria-label="Add reminder"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-600 text-white shadow-md shadow-blue-500/25 hover:bg-blue-700 active:scale-90 transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <Plus size={22} strokeWidth={2.75} />
            </Link>
          )}
          <ThemeToggle />
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            {menuOpen ? <X size={20} strokeWidth={2.25} /> : <Menu size={20} strokeWidth={2.25} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden">
          <nav
            id="mobile-menu"
            ref={panelRef}
            aria-label="Mobile"
            className="absolute inset-x-0 top-full z-50 max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-b border-sky-100 bg-[color:var(--rm-page)] px-4 pb-6 pt-3 shadow-xl"
          >
            <ul className="flex flex-col gap-1">
              {links.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-3 text-[15px] font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-blue-50'
                      }`
                    }
                  >
                    <Icon size={19} strokeWidth={2.25} />
                    {label}
                  </NavLink>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid gap-2.5 border-t border-sky-100 pt-4">
              {isLoggedIn ? (
                <>
                  <Link
                    to="/create-task"
                    className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
                  >
                    <Plus size={18} strokeWidth={2.5} /> New reminder
                  </Link>
                  <PushButton pushStatus={pushStatus} onClick={toggle} fullWidth />
                  <Link
                    to="/profile"
                    className="flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    {avatarUrl ? (
                      <img src={getAvatarSrc()} alt="" width="22" height="22" className="h-[22px] w-[22px] rounded-full object-cover" />
                    ) : (
                      <CircleUser size={20} />
                    )}
                    Profile &amp; settings
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="flex items-center justify-center gap-2 rounded-full bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-500/20 hover:bg-blue-700 active:scale-[0.98] transition-all"
                  >
                    <UserPlus size={18} /> Get Started
                  </Link>
                  <Link
                    to="/login"
                    className="flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    <LogIn size={18} /> Log in
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
    {/* Backdrop lives OUTSIDE the header (the header's blur would otherwise trap position:fixed) */}
    {menuOpen && (
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={() => closeMenu(true)}
        className="md:hidden fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[2px] cursor-default"
      />
    )}
    </>
  );
};

export default Header;
