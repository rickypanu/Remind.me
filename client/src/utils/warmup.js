import { healthApi } from "../api";
import { API_ORIGIN } from "./api";

let started = false;

/**
 * Wake the API while the page is still loading. Free hosting puts a server to sleep after a quiet spell and a cold
 * start can take 30 s or more; asking for /health immediately (and opening the connection early) means the server
 * is already awake, or well on its way, by the time the first real request is made. Fire and forget; never throws.
 */
export function warmUpServer() {
  if (started || typeof document === "undefined") return;
  started = true;
  try {
    const link = document.createElement("link");
    link.rel = "preconnect";
    link.href = API_ORIGIN;
    link.crossOrigin = "anonymous";
    document.head.appendChild(link);
  } catch {
    /* a hint only */
  }
  healthApi.check({ timeout: 60000 });
}
