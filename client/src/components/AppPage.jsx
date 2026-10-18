import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Header from "../pages/components/Header";
import PageHeader from "./PageHeader";

const WIDTHS = {
  narrow: "max-w-2xl", // forms and settings
  default: "max-w-3xl", // lists and reading pages (same width as the dashboard)
};

export default function AppPage({
  title,
  subtitle,
  backTo,
  backLabel,
  actions,
  width = "default",
  centerHeader = false,
  children,
}) {
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
        <div
          className={`mx-auto w-full ${WIDTHS[width] || WIDTHS.default} px-4 sm:px-6 pt-6 sm:pt-8 pb-24`}
        >
          {title && centerHeader ? (
            <div className="mb-8">
              {backTo && (
                <Link
                  to={backTo}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors mb-4"
                >
                  <ArrowLeft size={16} />
                  {backLabel || "Back"}
                </Link>
              )}
              <div className="text-center">
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1 text-slate-500 font-medium">{subtitle}</p>
                )}
              </div>
            </div>
          ) : (
            title && (
              <PageHeader
                title={title}
                subtitle={subtitle}
                backTo={backTo}
                backLabel={backLabel}
                actions={actions}
              />
            )
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
