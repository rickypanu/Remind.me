import React from "react";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";

/** Page frame shared by the account screens: logo, theme switch, soft glows and the white card. */
export default function AuthShell({ children }) {
  return (
    <div className="rm-display relative flex items-center justify-center min-h-screen px-4 pt-24 pb-10 bg-gradient-to-b from-[color:var(--rm-hero-top)] to-[color:var(--rm-page)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4">
        <Logo />
        <ThemeToggle />
      </div>

      {/* Soft background glows */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-80 h-80 rounded-full bg-sky-200/50 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-emerald-100/60 blur-3xl" aria-hidden="true" />

      <main id="main" className="rm-rise relative w-full max-w-md p-6 sm:p-9 bg-white rounded-[2rem] border border-sky-100 shadow-[0_30px_80px_-30px_rgba(37,99,235,0.35)]">
        {children}
      </main>
    </div>
  );
}
