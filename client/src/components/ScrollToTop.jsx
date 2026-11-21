import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Every page opens at the top. React Router keeps the previous scroll position by default, which is
 * why a new page used to open half-way down. Links that point at a #section are left alone.
 */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if ("scrollRestoration" in window.history) window.history.scrollRestoration = "manual";
  }, []);

  useEffect(() => {
    if (hash) {
      // In-app navigation never makes the browser jump to an #anchor, so do it here once the page has rendered.
      const id = decodeURIComponent(hash.slice(1));
      const timer = window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "start" }), 60);
      return () => window.clearTimeout(timer);
    }
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    return undefined;
  }, [pathname, hash]);

  return null;
}
