import React from "react";
import { Link } from "react-router-dom";

/** The Deadline mark: calendar with a check, a speed swoosh and a clock hand, on a deep navy tile. */
export function LogoMark({ size = 36, className = "" }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 512 512" width={size} height={size} className={`shrink-0 ${className}`}>
      <defs>
        <linearGradient id="dl-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#171A4A" /><stop offset="1" stopColor="#070B1F" /></linearGradient>
        <linearGradient id="dl-mk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#C4B5FD" /><stop offset="1" stopColor="#7C3AED" /></linearGradient>
      </defs>
      <rect width="512" height="512" rx="115" fill="url(#dl-bg)" />
      <g transform="translate(256 256) translate(-286 -280)" fill="none" stroke="url(#dl-mk)" strokeLinecap="round" strokeLinejoin="round">
        <rect x="104" y="150" width="262" height="262" rx="46" strokeWidth="26" />
        <path d="M168 112 V170 M302 112 V170" strokeWidth="26" />
        <path d="M170 292 L232 352 L318 232" strokeWidth="30" />
        <path d="M318 424 C 352 330, 408 252, 468 206" strokeWidth="24" />
        <path d="M356 446 C 392 372, 436 316, 486 280" strokeWidth="14" />
        <path d="M400 330 L384 282" strokeWidth="14" />
        <path d="M392 196 L404 168 M440 176 L458 150 M462 244 L494 232" strokeWidth="12" />
        <circle cx="400" cy="332" r="17" fill="url(#dl-mk)" stroke="none" />
      </g>
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
      className={`inline-flex items-center gap-2.5 group select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <LogoMark size={px} className="rounded-xl shadow-md shadow-indigo-900/20 transition-transform group-hover:-translate-y-0.5" />
      <span className="text-[19px] font-extrabold tracking-tight text-slate-800">
        Dead<span className="text-blue-600">line</span>
      </span>
    </Link>
  );
}
