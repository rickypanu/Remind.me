import React from "react";
import { Link } from "react-router-dom";

/** The Deadline mark: a stopwatch whose ring is almost run out, with an amber dot where time ends. */
export function LogoMark({ size = 36, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="dl-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#C026D3" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="118" fill="url(#dl-grad)" />
      <rect x="226" y="86" width="60" height="30" rx="12" fill="#fff" />
      <circle cx="256" cy="268" r="132" fill="none" stroke="#fff" strokeWidth="36" strokeLinecap="round" strokeDasharray="612 220" transform="rotate(-90 256 268)" />
      <path d="M256 268 V190 M256 268 L312 304" stroke="#fff" strokeWidth="30" strokeLinecap="round" fill="none" />
      <circle cx="124" cy="268" r="30" fill="#FBBF24" stroke="#fff" strokeWidth="12" />
    </svg>
  );
}

/** Clickable brand mark. Always a real <Link> so it works with keyboard, middle-click and "open in new tab". */
export default function Logo({ to = "/", className = "", size = "md" }) {
  const px = size === "lg" ? 44 : 36;
  return (
    <Link
      to={to}
      aria-label="Deadline home"
      className={`inline-flex items-center gap-2.5 group select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${className}`}
    >
      <LogoMark size={px} className="shrink-0 rounded-xl shadow-md shadow-violet-500/30 transition-transform group-hover:-translate-y-0.5" />
      <span className="text-[19px] font-extrabold tracking-tight text-slate-800">
        Dead<span className="text-violet-600">line</span>
      </span>
    </Link>
  );
}
