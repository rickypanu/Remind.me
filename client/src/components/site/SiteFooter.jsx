import React from "react";
import { Link } from "react-router-dom";
import { SiteLogo } from "./SiteHeader";
import { SITE, mailto, telHref } from "../../config/site";
import { useI18n } from "../../i18n";

export default function SiteFooter() {
  const { t } = useI18n();
  return (
    <footer className="rs-footer">
      <div className="rs-wrap">
        <div className="rs-footer-grid">
          <div>
            <SiteLogo />
            <p className="rs-foot-note">{t("Forget less. Do more.")}</p>
          </div>
          <div>
            <h4>{t("Service")}</h4>
            <ul>
              <li><Link to="/#services">{t("Services")}</Link></li>
              <li><Link to="/#how">{t("How it works")}</Link></li>
              <li><Link to="/#use-cases">{t("Who it's for")}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t("Company")}</h4>
            <ul>
              <li><Link to="/about">{t("About")}</Link></li>
              <li><Link to="/faqs">{t("FAQs")}</Link></li>
              <li><Link to="/terms">{t("Terms & Privacy")}</Link></li>
            </ul>
          </div>
          <div>
            <h4>{t("Contact")}</h4>
            <ul>
              <li><a href={mailto("GetRemindMe support")} style={{ overflowWrap: "anywhere" }}>{SITE.supportEmail}</a></li>
              {SITE.supportPhone && <li><a href={telHref(SITE.supportPhone)}>{SITE.supportPhone}</a></li>}
              <li><a href={SITE.repoUrl} target="_blank" rel="noopener noreferrer">GitHub</a></li>
            </ul>
          </div>
        </div>
        <div className="rs-foot-bottom">
          <span>
            © {new Date().getFullYear()} {SITE.name}. {t("All rights reserved.")}
          </span>
          <span>
            {t("Designed & developed by")}{" "}
            <a href="https://rickypanu.vercel.app" target="_blank" rel="noopener noreferrer" className="rs-link">
              Ricky Panu
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
