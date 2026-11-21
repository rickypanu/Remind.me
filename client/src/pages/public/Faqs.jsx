import React, { useMemo, useState } from "react";
import SiteLayout from "../../components/site/SiteLayout";
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
    <SiteLayout>
      <section className="rs-page-head">
        <div className="rs-wrap">
          <span className="rs-eyebrow">
            <b>FAQ</b> Help centre
          </span>
          <h1>How can we help?</h1>
          <p className="rs-lede">Answers about reminders, offline use, notifications, themes and your account.</p>
        </div>
      </section>

      <div className="rs-page-body">
        <div className="rs-wrap" style={{ maxWidth: 860 }}>
          <div className="rs-faq-tools">
            <FaqSearch value={searchQuery} onChange={search} onClear={() => search("")} />
            <FaqCategoryTabs faqs={FAQS} categories={FAQ_CATEGORIES} active={activeCategory} onChange={chooseCategory} />
          </div>

          {/* Announced to screen readers whenever the list changes */}
          <p role="status" className={trimmed ? "rs-note" : "sr-only"} style={trimmed ? { marginBottom: 12 } : undefined}>
            {trimmed || activeCategory !== "All"
              ? `${filtered.length} result${filtered.length === 1 ? "" : "s"}${trimmed ? ` for “${trimmed}”` : ""}`
              : ""}
          </p>

          <div className="rs-faq" style={{ minHeight: 300 }}>
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
    </SiteLayout>
  );
}
