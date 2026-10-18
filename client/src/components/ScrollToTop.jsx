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
    if (hash) return; // let the browser jump to the #anchor
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname, hash]);

  return null;
}
