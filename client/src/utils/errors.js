/**
 * Turn whatever went wrong into a sentence a person can act on.
 * Handles FastAPI's `detail` as a string, as a list of validation errors, or missing entirely.
 */
export function getErrorMessage(err, fallback = "Something went wrong. Please try again.") {
  if (!err) return fallback;
  if (typeof err === "string") return err;

  // No response at all: offline, server asleep, CORS, DNS...
  if (err.request && !err.response) {
    return typeof navigator !== "undefined" && navigator.onLine === false
      ? "You appear to be offline. Check your connection and try again."
      : "Can't reach the server right now. It may be waking up, so please try again in a few seconds.";
  }

  const detail = err.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;

  if (Array.isArray(detail) && detail.length) {
    // FastAPI/Pydantic validation errors: [{ loc: ["body","title"], msg: "..." }]
    const first = detail[0];
    const field = Array.isArray(first?.loc) ? first.loc[first.loc.length - 1] : null;
    const msg = String(first?.msg || "").replace(/^Value error, /i, "");
    if (msg) return field && typeof field === "string" && field !== "body" ? `${prettify(field)}: ${msg}` : msg;
  }

  switch (err.response?.status) {
    case 401: return "Your session has expired. Please log in again.";
    case 403: return "You don't have permission to do that.";
    case 404: return "We couldn't find that. It may have been removed.";
    case 413: return "That file is too large.";
    case 429: return "Too many attempts. Please wait a moment and try again.";
    case 503: return "The service is busy right now. Please try again shortly.";
    default: return fallback;
  }
}

const prettify = (s) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
