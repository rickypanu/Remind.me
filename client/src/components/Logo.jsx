import React from "react";
import { Link } from "react-router-dom";
import { Timer } from "lucide-react";

/** The Deadline mark: a solid accent tile with a timer. Follows the accent colour the visitor chose. */
export function LogoMark({ size = 36, className = "" }) {
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white ${className}`}
    >
      <Timer size={Math.round(size * 0.58)} strokeWidth={2.4} />
    </span>
  );
}

/** Clickable brand mark. Always a real <Link> so it works with keyboard, middle-click and "open in new tab". */
export default function Logo({ to = "/", className = "", size = "md" }) {
  const px = size === "lg" ? 44 : 36;
  return (
    <Link
      to={to}
      aria-label="Deadline home"
      className={`inline-flex items-center gap-2.5 group select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <LogoMark size={px} className="shadow-md shadow-blue-500/25 transition-all group-hover:bg-blue-700 group-hover:-translate-y-0.5" />
      <span className="text-[19px] font-extrabold tracking-tight text-slate-800">
        Dead<span className="text-blue-600">line</span>
      </span>
    </Link>
  );
}
