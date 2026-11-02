import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Bell, CircleUser, House, Plus } from "lucide-react";
import { isLoggedIn } from "../utils/auth";

// Pages that show the tab bar (signed-in app screens only)
const APP_PATHS = ["/dashboard", "/create-task", "/profile", "/notifications", "/updates", "/telegram-setup"];

const tabClass = ({ isActive }) =>
  `rm-tab flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-bold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
    isActive ? "text-blue-700" : "text-slate-600 hover:text-slate-900"
  }`;

/**
 * iOS-style tab bar for phones: Today / Add / Alerts / Profile. Hidden from md up (the header has the same links) and
 * on public pages. It sits above the home indicator (safe-area inset) and the pages leave room for it.
 */
export default function BottomNav() {
  const { pathname } = useLocation();
  if (!isLoggedIn() || !APP_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <nav aria-label="App" className="rm-bottom-nav md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-1 px-3 pt-1.5">
        <NavLink to="/dashboard" className={tabClass}>
          <House size={22} strokeWidth={2.3} aria-hidden="true" />
          Today
        </NavLink>
        <NavLink to="/create-task" aria-label="New reminder" className="flex flex-1 items-center justify-center">
          {({ isActive }) => (
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-blue-600/30 transition-transform active:scale-90 ${
                isActive ? "ring-4 ring-blue-500/25" : ""
              }`}
            >
              <Plus size={26} strokeWidth={2.8} aria-hidden="true" />
            </span>
          )}
        </NavLink>
        <NavLink to="/notifications" className={tabClass}>
          <Bell size={22} strokeWidth={2.3} aria-hidden="true" />
          Alerts
        </NavLink>
        <NavLink to="/profile" className={tabClass}>
          <CircleUser size={22} strokeWidth={2.3} aria-hidden="true" />
          Profile
        </NavLink>
      </div>
    </nav>
  );
}
