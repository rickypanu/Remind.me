import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

/**
 * Title block used at the top of every inner page: optional back link, page title, subtitle and an
 * optional action on the right. One component = every page has the same spacing and type scale.
 *   backTo="/profile"  -> goes to that page
 *   backTo={true}      -> goes back in history
 */
export default function PageHeader({ title, subtitle, backTo, backLabel = "Back", actions }) {
  const navigate = useNavigate();
  const backClass =
    "inline-flex items-center gap-1.5 -ml-2 min-h-10 rounded-lg px-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500";

  return (
    <header className="mb-6 sm:mb-8">
      {backTo === true ? (
        <button type="button" onClick={() => navigate(-1)} className={backClass}>
          <ArrowLeft size={16} strokeWidth={2.5} /> {backLabel}
        </button>
      ) : backTo ? (
        <Link to={backTo} className={backClass}>
          <ArrowLeft size={16} strokeWidth={2.5} /> {backLabel}
        </Link>
      ) : null}

      {title && (
      <div className="mt-4 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">{title}</h1>
          {subtitle && <p className="mt-1.5 max-w-xl text-sm sm:text-[15px] leading-relaxed text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      )}
    </header>
  );
}
