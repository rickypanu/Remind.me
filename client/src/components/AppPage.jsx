import React from "react";
import Header from "../pages/components/Header";
import PageHeader from "./PageHeader";

const WIDTHS = {
  narrow: "max-w-2xl", // forms and settings
  default: "max-w-3xl", // lists and reading pages (same width as the dashboard)
};

/**
 * Shell for every signed-in page: the global header, one centred content column with the same
 * padding everywhere, then a consistent title block. Pages only supply their content.
 *
 *   <AppPage title="Notifications" subtitle="..." backTo="/profile" width="narrow">...</AppPage>
 */
export default function AppPage({ title, subtitle, backTo, backLabel, actions, width = "default", children }) {
  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--rm-page)] text-slate-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1 w-full">
        <div className={`mx-auto w-full ${WIDTHS[width] || WIDTHS.default} px-4 sm:px-6 pt-6 sm:pt-8 pb-24`}>
          {title && <PageHeader title={title} subtitle={subtitle} backTo={backTo} backLabel={backLabel} actions={actions} />}
          {children}
        </div>
      </main>
    </div>
  );
}
