import React from "react";
import Header from "../pages/components/Header";
import Footer from "../pages/components/Footer";

/** Header + page + footer for content pages (About, FAQs, Terms, 404). */
export default function PublicLayout({ children, className = "" }) {
  return (
    <div className={`min-h-screen flex flex-col bg-[color:var(--rm-page)] text-slate-800 ${className}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-grow w-full">
        {children}
      </main>
      <Footer />
    </div>
  );
}
