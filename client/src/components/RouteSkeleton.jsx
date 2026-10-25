import React from "react";

/** Shown while a page's code downloads. Light on purpose: it replaces the page area only, never the whole screen. */
export default function RouteSkeleton() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 text-slate-600">
        <span className="h-8 w-8 rounded-full border-[3px] border-slate-200 border-t-blue-600 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        <span className="text-sm font-medium">Loading…</span>
      </div>
    </div>
  );
}
