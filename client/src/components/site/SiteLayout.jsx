import React from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

/** Header + page + footer for every public page. All styling lives in src/site.css under .rs. */
export default function SiteLayout({ children, className = "" }) {
  return (
    <div className={`rs ${className}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg focus:text-slate-900">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="rs-main">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
