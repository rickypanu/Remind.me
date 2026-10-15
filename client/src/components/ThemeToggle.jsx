import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../theme/ThemeContext";

/**
 * Light / dark switch. Reads and writes the same saved preference as the Profile page, so
 * the choice is remembered on this device and applied on every page.
 */
export default function ThemeToggle({ className = "", showLabel = false }) {
  const { isDark, toggleColorMode } = useTheme();
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggleColorMode}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center gap-2 h-10 min-w-10 rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
        showLabel ? "px-4 text-sm font-semibold" : "w-10"
      } ${className}`}
    >
      {isDark ? <Sun size={18} strokeWidth={2.25} /> : <Moon size={18} strokeWidth={2.25} />}
      {showLabel && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
