import React from "react";
import Logo from "../../components/Logo";
import ThemeToggle from "../../components/ThemeToggle";

/** Page frame shared by the account screens: logo, theme switch and one flat card on the paper background. */
export default function AuthShell({ children }) {
  return (
    <div className="rm-display relative flex items-center justify-center min-h-screen px-4 pt-24 pb-10 bg-[color:var(--rm-page)] overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4">
        <Logo />
        <ThemeToggle />
      </div>

      <main id="main" className="rm-rise relative w-full max-w-md p-6 sm:p-9 bg-white rounded-2xl border-[1.5px] border-slate-900 shadow-[6px_6px_0_0_#14161f]">
        {children}
      </main>
    </div>
  );
}
