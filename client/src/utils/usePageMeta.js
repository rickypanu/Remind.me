import { useEffect } from "react";
import { OG_IMAGE, absoluteUrl, fullTitleOf } from "../seo/routes";

const JSON_LD_ID = "rm-jsonld";

function upsert(tag, selector, attrs, content, attribute = "content") {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, value));
    document.head.appendChild(el);
  }
  el.setAttribute(attribute, content);
}

const setMeta = (selector, attrs, content) => upsert("meta", selector, attrs, content);

/** Origin used for canonical and share-image URLs: the configured site URL, else the page you are on. */
function siteOrigin() {
  const configured = import.meta.env.VITE_SITE_URL;
  return (configured || window.location.origin).replace(/\/+$/, "");
}

/**
 * Keeps the tab title and head tags right while the user navigates (the first load is already correct because the
 * public pages are prerendered, see scripts/prerender.mjs). Updates description, Open Graph, Twitter card,
 * canonical URL, robots and JSON-LD together.
 *
 *   usePageMeta(routeMeta("/faqs"))                         // public page: registered in src/seo/routes.js
 *   usePageMeta({ title: "Dashboard", description, noindex: true })   // private page
 */
export default function usePageMeta({ title, fullTitle, description, noindex = false, path, jsonLd }) {
  const jsonLdText = jsonLd ? JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd) : "";

  useEffect(() => {
    const finalTitle = fullTitleOf({ title, fullTitle });
    document.title = finalTitle;

    if (description) {
      setMeta('meta[name="description"]', { name: "description" }, description);
      setMeta('meta[property="og:description"]', { property: "og:description" }, description);
      setMeta('meta[name="twitter:description"]', { name: "twitter:description" }, description);
    }
    setMeta('meta[property="og:title"]', { property: "og:title" }, finalTitle);
    setMeta('meta[name="twitter:title"]', { name: "twitter:title" }, finalTitle);
    setMeta('meta[name="robots"]', { name: "robots" }, noindex ? "noindex, nofollow" : "index, follow");

    const origin = siteOrigin();
    const pagePath = path || window.location.pathname;
    const url = absoluteUrl(origin, pagePath);
    upsert("link", 'link[rel="canonical"]', { rel: "canonical" }, url, "href");
    setMeta('meta[property="og:url"]', { property: "og:url" }, url);
    setMeta('meta[property="og:image"]', { property: "og:image" }, absoluteUrl(origin, OG_IMAGE.path));
    setMeta('meta[name="twitter:image"]', { name: "twitter:image" }, absoluteUrl(origin, OG_IMAGE.path));

    // Structured data belongs to one page: replace it on every navigation, remove it when the page has none.
    document.getElementById(JSON_LD_ID)?.remove();
    if (jsonLdText) {
      const script = document.createElement("script");
      script.id = JSON_LD_ID;
      script.type = "application/ld+json";
      script.textContent = jsonLdText;
      document.head.appendChild(script);
    }
  }, [title, fullTitle, description, noindex, path, jsonLdText]);
}
