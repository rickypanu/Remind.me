import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowRight, Globe, Menu, Moon, Sun, X } from "../icons";
import { LogoMark } from "../Logo";
import { useTheme } from "../../theme/ThemeContext";
import { useI18n } from "../../i18n";
import { isLoggedIn as hasSession } from "../../utils/auth";

// Same-page sections live on Home; the rest are their own pages.
const LINKS = [
  { to: "/#services", label: "Services" },
  { to: "/#how", label: "How it works" },
  { to: "/#use-cases", label: "Who it's for" },
  { to: "/faqs", label: "FAQs" },
  { to: "/about", label: "About" },
];

export function SiteLogo({ to = "/" }) {
  return (
    <Link to={to} className="rs-logo" aria-label="GetRemindMe home">
      <LogoMark size={38} />
      <span className="rs-logo-word">
        GetRemind<i>Me</i>
      </span>
    </Link>
  );
}

function LangSelect() {
  const { lang, setLang, languages, t } = useI18n();
  return (
    <label className="rs-lang">
      <span className="sr-only">{t("Language")}</span>
      <Globe size={16} />
      <select value={lang} onChange={(e) => setLang(e.target.value)}>
        {languages.map((l) => (
          <option key={l.code} value={l.code}>
            {l.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SiteHeader() {
  const { t } = useI18n();
  const { isDark, toggleColorMode } = useTheme();
  const loggedIn = hasSession();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const burger = useRef(null);
  const panel = useRef(null);

  const close = useCallback((refocus = false) => {
    setOpen(false);
    if (refocus) burger.current?.focus();
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && close(true);
    const onResize = () => window.matchMedia("(min-width: 900px)").matches && setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector("a,button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = prev;
    };
  }, [open, close]);

  const modeLabel = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <header className="rs-header">
      <div className="rs-wrap rs-header-in">
        <SiteLogo />
        <nav className="rs-nav" aria-label="Main">
          {LINKS.map((l) =>
            l.to.includes("#") ? (
              <Link key={l.to} to={l.to}>
                {t(l.label)}
              </Link>
            ) : (
              <NavLink key={l.to} to={l.to}>
                {t(l.label)}
              </NavLink>
            ),
          )}
        </nav>
        <div className="rs-header-end">
          <span className="rs-hide-sm">
            <LangSelect />
          </span>
          <button type="button" className="rs-icon-btn" onClick={toggleColorMode} aria-label={modeLabel} title={modeLabel}>
            {isDark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          {loggedIn ? (
            <Link to="/dashboard" className="rs-btn rs-btn--gold rs-btn--small rs-hide-sm">
              {t("Open dashboard")} <ArrowRight size={16} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="rs-btn rs-btn--line rs-btn--small rs-hide-sm">
                {t("Log in")}
              </Link>
              <Link to="/register" className="rs-btn rs-btn--gold rs-btn--small rs-hide-sm">
                {t("Get Started")}
              </Link>
            </>
          )}
          <button
            ref={burger}
            type="button"
            className="rs-burger"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? t("Close menu") : t("Open menu")}
            aria-expanded={open}
            aria-controls="rs-sheet"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="rs-sheet" ref={panel} className="rs-sheet" aria-label="Mobile">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="rs-sheet-link">
              {t(l.label)} <ArrowRight size={20} />
            </Link>
          ))}
          <div className="rs-sheet-actions">
            <LangSelect />
            {loggedIn ? (
              <Link to="/dashboard" className="rs-btn rs-btn--gold">
                {t("Open dashboard")}
              </Link>
            ) : (
              <>
                <Link to="/register" className="rs-btn rs-btn--gold">
                  {t("Get Started")}
                </Link>
                <Link to="/login" className="rs-btn rs-btn--line">
                  {t("Log in")}
                </Link>
              </>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
