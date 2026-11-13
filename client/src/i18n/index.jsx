import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CODES, LANG_KEY, PICKER_LANGUAGES, LANGUAGES, dateLocale, htmlLang } from "./languages";
import { applyDictionary } from "./translator";

/**
 * Tiny translation layer with no extra packages.
 *   const { t } = useI18n();   t("Add a reminder")   t("Hello, {name}", { name })
 * The English sentence IS the key. If a language has no entry for it the English text is shown, so a missing
 * translation never breaks a screen. Locale files (./locales/<code>.js) are loaded only when chosen.
 */
const loaders = import.meta.glob("./locales/*.js");

const read = () => {
  try {
    return localStorage.getItem(LANG_KEY);
  } catch {
    return null;
  }
};

// English until the visitor picks a language; the choice is remembered on this device.
const detect = () => {
  const saved = read();
  return CODES.includes(saved) ? saved : "en";
};

const fill = (text, vars) => (vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m)) : text);

const I18nContext = createContext({ t: (s, v) => fill(s, v), lang: "en", locale: "en-US", setLang: () => {}, languages: PICKER_LANGUAGES });

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(detect);
  const [dict, setDict] = useState({});

  // The page itself (every heading, label, paragraph, placeholder) is translated from the same dictionary.
  useEffect(() => {
    applyDictionary(dict);
  }, [dict]);

  useEffect(() => {
    let alive = true;
    const root = document.documentElement;
    const meta = LANGUAGES.find((l) => l.code === lang);
    root.lang = htmlLang(lang);
    root.dir = meta?.dir || "ltr";
    if (lang === "en" || !loaders[`./locales/${lang}.js`]) {
      setDict({});
      return undefined;
    }
    loaders[`./locales/${lang}.js`]()
      .then((m) => alive && setDict(m.default || {}))
      .catch(() => alive && setDict({}));
    return () => {
      alive = false;
    };
  }, [lang]);

  const setLang = useCallback((code) => {
    if (!CODES.includes(code)) return;
    try {
      localStorage.setItem(LANG_KEY, code);
    } catch {
      /* private mode: the choice lasts for this visit only */
    }
    setLangState(code);
  }, []);

  const t = useCallback((text, vars) => fill(dict[text] ?? text, vars), [dict]);
  const value = useMemo(() => ({ t, lang, locale: dateLocale(lang), setLang, languages: PICKER_LANGUAGES }), [t, lang, setLang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
