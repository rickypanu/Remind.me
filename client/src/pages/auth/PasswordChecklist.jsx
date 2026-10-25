import React from "react";
import { CheckCircle, Circle } from "lucide-react";
import { PASSWORD_CRITERIA } from "./registerValidation";

/** Strength bar and requirement checklist. Changes are announced politely (finding X6). */
export default function PasswordChecklist({ evaluation, hasInput, id }) {
  const { met, metCount, strength } = evaluation;
  return (
    <div id={id}>
      {hasInput && (
        <div className="pt-1.5">
          <div className="flex gap-1.5" aria-hidden="true">
            {PASSWORD_CRITERIA.map((criterion, index) => (
              <span
                key={criterion.key}
                className={`h-1.5 flex-1 rounded-full transition-colors ${index < metCount ? strength.bar : "bg-slate-200"}`}
              />
            ))}
          </div>
          <p aria-live="polite" className={`mt-1.5 text-xs font-semibold ${strength.text}`}>
            Password strength: {strength.label}
          </p>
        </div>
      )}

      <ul aria-live="polite" className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-y-1.5 gap-x-2">
        {PASSWORD_CRITERIA.map(({ key, label }) => (
          <li
            key={key}
            className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
              met[key] ? "text-emerald-700" : "text-slate-600"
            } ${key === "special" ? "sm:col-span-2" : ""}`}
          >
            {met[key] ? (
              <CheckCircle size={15} aria-hidden="true" className="text-emerald-600" />
            ) : (
              <Circle size={15} aria-hidden="true" className="text-slate-500" />
            )}
            {label}
            <span className="sr-only">{met[key] ? " (done)" : " (not yet)"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
