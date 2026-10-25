import { useEffect, useState } from "react";
import { healthApi } from "../api";

const SLOW_AFTER_MS = 5000;
const GIVE_UP_AFTER_MS = 45000;

/** "checking" -> ("waking" if slow: free hosting sleeps) -> "ok" | "down". */
export default function useApiHealth() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const controller = new AbortController();
    const slowTimer = setTimeout(() => setStatus((s) => (s === "checking" ? "waking" : s)), SLOW_AFTER_MS);

    healthApi.check({ signal: controller.signal, timeout: GIVE_UP_AFTER_MS }).then((ok) => {
      if (!controller.signal.aborted) setStatus(ok ? "ok" : "down");
    });

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, []);

  return status;
}
