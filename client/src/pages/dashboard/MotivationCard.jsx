import React, { useMemo, useState } from "react";
import { Flame, Quote, RefreshCw } from "lucide-react";
import { buildMotivation } from "./motivation";

/**
 * The dashboard's motivation card. The headline speaks to the user (name, streak, what is done and left today);
 * the quote is a line from an athlete, leader or thinker, or a plain line for the moment, chosen to match.
 * The refresh button shows another quote.
 */
export default function MotivationCard({ name, userId, dayKey, hour, streak, bestStreak, doneToday, pendingToday, overdue }) {
  const [shuffle, setShuffle] = useState(0);

  const { headline, quote } = useMemo(
    () => buildMotivation({ name, userId, dayKey, hour, streak, bestStreak, doneToday, pendingToday, overdue }, shuffle),
    [name, userId, dayKey, hour, streak, bestStreak, doneToday, pendingToday, overdue, shuffle]
  );

  const onStreak = Number.isFinite(streak) && streak >= 1;

  return (
    <section aria-label="Daily motivation" className="mb-6 rounded-[24px] border border-slate-100 bg-white p-4 sm:p-5 shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Quote size={17} strokeWidth={2.5} aria-hidden="true" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-slate-900">{headline}</p>

          <figure className="mt-2" aria-live="polite">
            <blockquote className="text-[15px] font-medium leading-relaxed text-slate-700 text-pretty">“{quote.text}”</blockquote>
            {quote.author && (
              <figcaption className="mt-1.5 text-xs font-semibold text-slate-500">
                — {quote.author}
                {quote.role && <span className="font-medium">, {quote.role}</span>}
              </figcaption>
            )}
          </figure>

          {onStreak && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
              <Flame size={13} strokeWidth={2.5} aria-hidden="true" />
              {streak}-day streak
              {bestStreak > streak ? <span className="font-semibold text-amber-700/80">· best {bestStreak}</span> : null}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShuffle((count) => count + 1)}
          aria-label="Show another quote"
          title="Another quote"
          className="-mr-1 -mt-1 shrink-0 rounded-xl p-2.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <RefreshCw size={16} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
