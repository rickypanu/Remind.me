import { useEffect } from "react";

const SITE_NAME = "RemindMe";

function setMeta(selector, attrs, content) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

/**
 * Sets the tab title and meta description for the current page (and keeps Open Graph / Twitter in sync).
 *
 *   usePageMeta({ title: "FAQs", description: "Answers about ..." });          -> "FAQs | RemindMe"
 *   usePageMeta({ title: "Page not found", description: "...", noindex: true });
 *
 * `title` may include the site name already; pass `fullTitle` to use it verbatim (home page).
 */
export default function usePageMeta({ title, fullTitle, description, noindex = false }) {
  useEffect(() => {
    const finalTitle = fullTitle || (title ? `${title} | ${SITE_NAME}` : SITE_NAME);
    document.title = finalTitle;
    if (description) {
      setMeta('meta[name="description"]', { name: "description" }, description);
      setMeta('meta[property="og:description"]', { property: "og:description" }, description);
      setMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    }
    setMeta('meta[property="og:title"]', { property: "og:title" }, finalTitle);
    setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, finalTitle);
    setMeta('meta[name="robots"]', { name: "robots" }, noindex ? "noindex, nofollow" : "index, follow");
  }, [title, fullTitle, description, noindex]);
}
