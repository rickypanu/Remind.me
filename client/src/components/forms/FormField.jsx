import React from "react";
import { Check, XCircle } from "lucide-react";

const INPUT_BASE =
  "w-full py-3.5 pl-12 pr-12 bg-[color:var(--rm-soft)] border-2 rounded-2xl text-[color:var(--rm-ink)] font-medium placeholder:text-slate-500 placeholder:font-normal focus:bg-white focus:outline-none focus:ring-4 transition-all";
const TONE = {
  neutral: "border-transparent focus:border-blue-500 focus:ring-blue-500/15",
  good: "border-emerald-400 focus:border-emerald-500 focus:ring-emerald-500/15",
  bad: "border-rose-400 focus:border-rose-500 focus:ring-rose-500/15",
};
const ICON_TONE = {
  neutral: "text-slate-500 group-focus-within:text-blue-500",
  good: "text-emerald-600",
  bad: "text-rose-600",
};

/**
 * One labelled text field with an icon, a validity tick and an error message that is wired to the input
 * (finding X6): the input gets `aria-invalid` and `aria-describedby` pointing at the message, and the message is a
 * `role="alert"` paragraph, so a screen reader announces it the moment it appears and again when the field is focused.
 *
 *   state    "neutral" | "good" | "bad"    (colours; "bad" also sets aria-invalid)
 *   error    text shown (and announced) while state is "bad"
 *   hint     always-visible help text, also referenced by aria-describedby
 *   describedBy  extra element ids to reference (e.g. a form-level error banner)
 *   trailing a node on the right (e.g. the show-password button); replaces the tick
 */
export default function FormField({
  id,
  label,
  icon: Icon,
  state = "neutral",
  error,
  hint,
  describedBy: extraDescribedBy,
  trailing,
  inputRef,
  className = "",
  ...inputProps
}) {
  const invalid = state === "bad";
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy =
    [invalid && error ? errorId : null, hint ? hintId : null, extraDescribedBy].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative group">
        {Icon && (
          <Icon
            aria-hidden="true"
            size={20}
            className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${ICON_TONE[state]}`}
          />
        )}
        <input
          ref={inputRef}
          id={id}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className={`${INPUT_BASE} ${TONE[state]} ${className}`}
          {...inputProps}
        />
        {trailing ??
          (state === "good" && (
            <span
              aria-hidden="true"
              className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center"
            >
              <Check size={13} strokeWidth={3.5} />
            </span>
          ))}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      )}
      {invalid && error && (
        <p id={errorId} role="alert" className="text-rose-700 text-xs font-medium flex items-center gap-1.5">
          <XCircle size={14} aria-hidden="true" /> {error}
        </p>
      )}
    </div>
  );
}
