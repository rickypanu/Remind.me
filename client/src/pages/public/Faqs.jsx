import React, { useMemo, useState } from "react";
import PublicLayout from "../../components/PublicLayout";
import PageHeader from "../../components/PageHeader";
import usePageMeta from "../../utils/usePageMeta";
import { FAQS, FAQ_CATEGORIES } from "../../data/faqs.data";
import { routeMeta } from "../../seo/routes";
import FaqCategoryTabs from "./faq/FaqCategoryTabs";
import FaqEmpty from "./faq/FaqEmpty";
import FaqItem from "./faq/FaqItem";
import FaqSearch from "./faq/FaqSearch";
import SupportCta from "./faq/SupportCta";
import { filterFaqs } from "./faq/filterFaqs";

export default function FAQ() {
  usePageMeta(routeMeta("/faqs")); // includes the FAQPage structured data built from the same list
  const [openId, setOpenId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = useMemo(() => filterFaqs(FAQS, searchQuery, activeCategory), [searchQuery, activeCategory]);
  const trimmed = searchQuery.trim();

  const search = (value) => {
    setSearchQuery(value);
    setOpenId(null);
  };
  const chooseCategory = (category) => {
    setActiveCategory(category);
    setOpenId(null);
  };
  const reset = () => {
    search("");
    setActiveCategory("All");
  };

  return (
    <PublicLayout>
      <div className="pt-6 sm:pt-8 pb-16 px-4 sm:px-6 font-sans selection:bg-indigo-100 selection:text-indigo-900">
        <div className="max-w-3xl mx-auto space-y-8">
          <PageHeader
            backTo
            title="How can we help?"
            subtitle="Answers about reminders, offline use, notifications, themes and your account."
          />

          <FaqSearch value={searchQuery} onChange={search} onClear={() => search("")} />
          <FaqCategoryTabs faqs={FAQS} categories={FAQ_CATEGORIES} active={activeCategory} onChange={chooseCategory} />

          {/* Announced to screen readers whenever the list changes */}
          <p role="status" className={trimmed ? "text-sm text-slate-600 font-medium -mt-4" : "sr-only"}>
            {trimmed || activeCategory !== "All"
              ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}${trimmed ? ` for “${trimmed}”` : ""}`
              : ""}
          </p>

          <div className="space-y-3 min-h-[300px]">
            {filtered.length === 0 ? (
              <FaqEmpty query={searchQuery} onReset={reset} />
            ) : (
              filtered.map((faq) => (
                <FaqItem
                  key={faq.id}
                  faq={faq}
                  isOpen={openId === faq.id}
                  onToggle={() => setOpenId(openId === faq.id ? null : faq.id)}
                  query={searchQuery}
                  showCategory={activeCategory === "All"}
                />
              ))
            )}
          </div>

          <SupportCta />
        </div>
      </div>
    </PublicLayout>
  );
}
