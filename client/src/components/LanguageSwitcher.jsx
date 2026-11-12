import React from "react";
import { Globe } from "lucide-react";
import { useI18n } from "../i18n";

/** A native <select>: works with every keyboard and screen reader, and opens the phone's own picker. */
export default function LanguageSwitcher({ className = "" }) {
  const { lang, setLang, languages, t } = useI18n();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <span className="sr-only">{t("Language")}</span>
      <Globe size={16} aria-hidden="true" className="pointer-events-none absolute left-2.5 text-slate-500" />
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="h-10 appearance-none rounded-full border border-slate-200 bg-white pl-8 pr-3 text-sm font-semibold text-slate-700 shadow-sm outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}
