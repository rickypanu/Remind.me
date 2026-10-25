import React from "react";
import { countByCategory } from "./filterFaqs";
import { iconForCategory } from "./categoryIcons";

/** Row of category filters. It scrolls sideways on phones, so it is one of the few places the scrollbar is hidden. */
export default function FaqCategoryTabs({ faqs, categories, active, onChange }) {
  return (
    <div role="group" aria-label="Filter by category" className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      {categories.map((category) => {
        const Icon = iconForCategory(category);
        const isActive = active === category;
        return (
          <button
            key={category}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(category)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              isActive ? "bg-slate-900 text-white shadow-md" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Icon className="w-4 h-4" aria-hidden="true" />
            {category}
            <span className={`text-[11px] rounded-full px-1.5 py-0.5 ${isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"}`}>
              {countByCategory(faqs, category)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
