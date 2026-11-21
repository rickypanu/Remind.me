import React from "react";
import { Link } from "react-router-dom";

/** The brand mark: the RM monogram (public/rm-mark.png) on an ultramarine tile. */
export function LogoMark({ size = 36, className = "" }) {
  return <span aria-hidden="true" style={{ width: size, height: size }} className={`rm-mark ${className}`} />;
}

/** Clickable brand mark. Always a real <Link> so it works with keyboard, middle-click and "open in new tab". */
export default function Logo({ to = "/", className = "", size = "md" }) {
  const px = size === "lg" ? 44 : 36;
  return (
    <Link
      to={to}
      aria-label="GetRemindMe home"
      className={`inline-flex items-center gap-2.5 group select-none rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${className}`}
    >
      <LogoMark size={px} className="transition-transform group-hover:-rotate-6" />
      <span className="text-[19px] font-extrabold tracking-tight text-slate-800">
        GetRemind<span className="text-blue-600">Me</span>
      </span>
    </Link>
  );
}
