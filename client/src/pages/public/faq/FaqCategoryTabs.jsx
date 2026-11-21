import React from "react";
import { countByCategory } from "./filterFaqs";

/** Row of category filters. */
export default function FaqCategoryTabs({ faqs, categories, active, onChange }) {
  return (
    <div role="group" aria-label="Filter by category" className="rs-faq-cats">
      {categories.map((category) => (
        <button key={category} type="button" className="rs-faq-cat" aria-pressed={active === category} onClick={() => onChange(category)}>
          {category}
          <small>{countByCategory(faqs, category)}</small>
        </button>
      ))}
    </div>
  );
}
