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
export const ACCENT_KEY = "remindme-accent";

/** Accent colours offered in Profile. "black" is not an accent: it switches on the Minimalism theme. */
export const ACCENTS = [
  { id: "blue", label: "Blue", swatch: "#2563eb" },
  { id: "indigo", label: "Indigo", swatch: "#4f46e5" },
  { id: "violet", label: "Violet", swatch: "#7c3aed" },
  { id: "pink", label: "Pink", swatch: "#db2777" },
  { id: "orange", label: "Orange", swatch: "#ea580c" },
  { id: "green", label: "Green", swatch: "#059669" },
  { id: "teal", label: "Teal", swatch: "#0d9488" },
];
const ACCENT_IDS = ACCENTS.map((a) => a.id);

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

const getInitialAccent = () => {
  const saved = read(ACCENT_KEY);
  return ACCENT_IDS.includes(saved) ? saved : "blue";
};

const applyToDocument = (colorMode, themeStyle, accent) => {
  const root = document.documentElement;
  root.classList.toggle("dark", colorMode === "dark");
  root.dataset.theme = themeStyle;
  root.dataset.accent = accent;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", META_COLORS[`${themeStyle}-${colorMode}`]);
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [colorMode, setColorMode] = useState(getInitialColorMode);
  const [themeStyle, setThemeStyle] = useState(getInitialThemeStyle);
  const [accent, setAccentState] = useState(getInitialAccent);

  useEffect(() => {
    applyToDocument(colorMode, themeStyle, accent);
  }, [colorMode, themeStyle, accent]);

  // Keep other open tabs in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === COLOR_MODE_KEY && (e.newValue === "light" || e.newValue === "dark")) {
        setColorMode(e.newValue);
      }
      if (e.key === THEME_STYLE_KEY) {
        setThemeStyle(e.newValue === "minimal" ? "minimal" : "classic");
      }
      if (e.key === ACCENT_KEY) {
        setAccentState(ACCENT_IDS.includes(e.newValue) ? e.newValue : "blue");
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

  /** id = an accent colour (also leaves Minimalism) or "black" (turns Minimalism on). */
  const selectAccent = useCallback(
    (id) => {
      if (id === "black") {
        write(THEME_STYLE_KEY, "minimal");
        withTransition(() => setThemeStyle("minimal"));
        return;
      }
      if (!ACCENT_IDS.includes(id)) return;
      write(ACCENT_KEY, id);
      write(THEME_STYLE_KEY, "classic");
      withTransition(() => {
        setAccentState(id);
        setThemeStyle("classic");
      });
    },
    [withTransition],
  );

  const value = useMemo(
    () => ({
      colorMode,
      themeStyle,
      accent,
      selectAccent,
      isDark: colorMode === "dark",
      isMinimal: themeStyle === "minimal",
      setColorMode: setMode,
      setThemeStyle: setStyle,
      toggleColorMode: () => setMode(colorMode === "dark" ? "light" : "dark"),
      toggleThemeStyle: () => setStyle(themeStyle === "minimal" ? "classic" : "minimal"),
    }),
    [colorMode, themeStyle, accent, selectAccent, setMode, setStyle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
