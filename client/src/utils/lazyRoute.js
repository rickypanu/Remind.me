import { lazy } from "react";

const RELOAD_FLAG = "rm-chunk-reload";

/**
 * React.lazy for route pages, hardened for deployments: after a new release an open tab may ask for a chunk file
 * that no longer exists. The first time that happens the page reloads once (to pick up the new index.html);
 * if it fails again the error reaches the error boundary instead of looping.
 */
export function lazyRoute(importer) {
  return lazy(async () => {
    try {
      const module = await importer();
      try {
        sessionStorage.removeItem(RELOAD_FLAG);
      } catch {
        /* storage unavailable */
      }
      return module;
    } catch (error) {
      let alreadyReloaded = true;
      try {
        alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === "1";
        if (!alreadyReloaded) sessionStorage.setItem(RELOAD_FLAG, "1");
      } catch {
        /* cannot remember: do not risk a reload loop */
      }
      if (!alreadyReloaded && navigator.onLine) {
        window.location.reload();
        return new Promise(() => {}); // the page is going away; never resolve
      }
      throw error;
    }
  });
}
