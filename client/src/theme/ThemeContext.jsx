import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Two independent switches, both saved per device in localStorage:
 *   colorMode : "light" | "dark"        -> <html class="dark">
 *   themeStyle: "classic" | "minimal"   -> <html data-theme="classic|minimal">
 *
 * The same logic runs once in index.html before React loads (no flash of the
 * wrong theme) - keep the storage keys below in sync with that script.
 */
export const COLOR_MODE_KEY = "remindme-color-mode";
export const THEME_STYLE_KEY = "remindme-theme-style";

const META_COLORS = {
  "classic-light": "#ffffff",
  "classic-dark": "#0f1117",
  "minimal-light": "#fafafa",
  "minimal-dark": "#0a0a0a",
};

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode etc.) - theme still works for this session */
  }
};

const getInitialColorMode = () => {
  const saved = read(COLOR_MODE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  // No choice made yet: follow the device setting.
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const getInitialThemeStyle = () => (read(THEME_STYLE_KEY) === "minimal" ? "minimal" : "classic");

const applyToDocument = (colorMode, themeStyle) => {
  const root = document.documentElement;
  root.classList.toggle("dark", colorMode === "dark");
  root.dataset.theme = themeStyle;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_COLORS[`${themeStyle}-${colorMode}`]);
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [colorMode, setColorMode] = useState(getInitialColorMode);
  const [themeStyle, setThemeStyle] = useState(getInitialThemeStyle);

  useEffect(() => {
    applyToDocument(colorMode, themeStyle);
  }, [colorMode, themeStyle]);

  // Keep other open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === COLOR_MODE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setColorMode(e.newValue);
      }
      if (e.key === THEME_STYLE_KEY) {
        setThemeStyle(e.newValue === "minimal" ? "minimal" : "classic");
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Brief colour cross-fade when the user flips a switch (not on first paint).
  const withTransition = useCallback((update) => {
    const root = document.documentElement;
    root.classList.add("theme-transition");
    update();
    window.setTimeout(() => root.classList.remove("theme-transition"), 300);
  }, []);

  const setMode = useCallback(
    (mode) => {
      write(COLOR_MODE_KEY, mode);
      withTransition(() => setColorMode(mode));
    },
    [withTransition],
  );

  const setStyle = useCallback(
    (style) => {
      write(THEME_STYLE_KEY, style);
      withTransition(() => setThemeStyle(style));
    },
    [withTransition],
  );

  const value = useMemo(
    () => ({
      colorMode,
      themeStyle,
      isDark: colorMode === "dark",
      isMinimal: themeStyle === "minimal",
      setColorMode: setMode,
      setThemeStyle: setStyle,
      toggleColorMode: () => setMode(colorMode === "dark" ? "light" : "dark"),
      toggleThemeStyle: () => setStyle(themeStyle === "minimal" ? "classic" : "minimal"),
    }),
    [colorMode, themeStyle, setMode, setStyle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
