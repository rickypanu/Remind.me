import React from "react";
import { Link } from "react-router-dom";
import { LayoutDashboard } from "lucide-react";

/** Clickable brand mark. Always a real <Link> so it works with keyboard, middle-click and "open in new tab". */
export default function Logo({ to = "/", className = "", size = "md" }) {
  const box = size === "lg" ? "w-11 h-11" : "w-9 h-9";
  return (
    <Link
      to={to}
      aria-label="RemindMe home"
      className={`inline-flex items-center gap-2.5 group select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <span className={`${box} shrink-0 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/25 transition-all group-hover:bg-blue-700 group-hover:-translate-y-0.5`}>
        <LayoutDashboard size={size === "lg" ? 22 : 20} strokeWidth={2.5} />
      </span>
      <span className="text-[19px] font-extrabold tracking-tight text-slate-800">
        Remind<span className="text-blue-600">Me</span>
      </span>
    </Link>
  );
}
