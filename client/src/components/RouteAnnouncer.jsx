import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Single-page apps change the screen without a page load, so a screen reader hears nothing (finding X8).
 * After each navigation this announces the new page title through a polite live region and moves focus to the
 * page's <h1> (or <main>), so keyboard users continue from the top of the new page instead of from the old link.
 */
export default function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false; // the initial load is announced by the browser itself
      return undefined;
    }
    // Wait for the (lazy) page and its usePageMeta effect to render.
    const timer = setTimeout(() => {
      setMessage(document.title);
      const target = document.querySelector("main h1") || document.getElementById("main");
      if (target instanceof HTMLElement) {
        if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
        target.focus({ preventScroll: true });
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}
