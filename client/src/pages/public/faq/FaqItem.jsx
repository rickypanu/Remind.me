import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, ThumbsDown, ThumbsUp } from "lucide-react";
import Highlight from "./Highlight";
import { iconForCategory } from "./categoryIcons";

/** One question: a disclosure button plus its answer panel. */
export default function FaqItem({ faq, isOpen, onToggle, query, showCategory }) {
  const [vote, setVote] = useState(null); // 'up' | 'down' (kept only while the page is open)
  const panelId = `faq-panel-${faq.id}`;
  const buttonId = `faq-button-${faq.id}`;
  const CategoryIcon = iconForCategory(faq.category);

  return (
    <div
      className={`bg-white rounded-2xl border transition-colors duration-200 overflow-hidden ${
        isOpen ? "border-indigo-200 shadow-md shadow-indigo-100/50" : "border-slate-200 shadow-sm hover:border-slate-300"
      }`}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls={panelId}
          className="w-full px-5 py-4 sm:px-6 sm:py-5 flex justify-between items-center gap-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 group"
        >
          <span className="text-left min-w-0">
            {showCategory && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-1">
                <CategoryIcon className="w-3 h-3" aria-hidden="true" />
                {faq.category}
              </span>
            )}
            <span className="block font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
              <Highlight text={faq.question} query={query} />
            </span>
          </span>
          <span
            aria-hidden="true"
            className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors duration-200 ${
              isOpen ? "bg-indigo-50 text-indigo-600" : "bg-slate-50 text-slate-500 group-hover:bg-slate-100"
            }`}
          >
            <ChevronDown className={`w-5 h-5 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
          </span>
        </button>
      </h3>

      {/* Smooth accordion animation using CSS grid. `inert` keeps the hidden links out of the tab order. */}
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        inert={!isOpen}
        className={`grid transition-all duration-300 ease-in-out ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 sm:px-6 sm:pb-6 border-t border-slate-50 mt-2 pt-4 space-y-4">
            <p className="text-slate-600 text-sm leading-relaxed">
              <Highlight text={faq.answer} query={query} />
            </p>

            {faq.steps && (
              <ol className="space-y-2.5">
                {faq.steps.map((step, index) => (
                  <li key={step} className="flex gap-3 text-sm text-slate-600 leading-relaxed">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-indigo-50 text-indigo-700 text-xs font-bold flex items-center justify-center mt-0.5" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span>
                      <Highlight text={step} query={query} />
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {faq.link ? (
                <Link to={faq.link.to} className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-700 hover:text-indigo-800 transition-colors">
                  {faq.link.label}
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                {vote ? (
                  <span role="status">Thanks for your feedback!</span>
                ) : (
                  <>
                    <span>Was this helpful?</span>
                    <button type="button" onClick={() => setVote("up")} aria-label="Yes, this was helpful" className="p-1.5 rounded-lg hover:bg-emerald-50 hover:text-emerald-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <ThumbsUp className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => setVote("down")} aria-label="No, this was not helpful" className="p-1.5 rounded-lg hover:bg-rose-50 hover:text-rose-700 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
                      <ThumbsDown className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
