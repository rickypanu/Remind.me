import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bug, Code, ExternalLink, Lock, Mail, Repeat, Send, Smartphone, Edit } from "../../components/icons";
import SiteLayout from "../../components/site/SiteLayout";
import usePageMeta from "../../utils/usePageMeta";
import { routeMeta } from "../../seo/routes";
import useApiHealth from "../../hooks/useApiHealth";
import { SITE, mailto } from "../../config/site";

const APP_VERSION = "v021126";

// Live service status (useApiHealth pings the backend's /health endpoint)
const STATUS = {
  checking: "Checking status…",
  waking: "Connecting…",
  ok: "All systems operational",
  down: "Connection issue",
};

const FEATURES = [
  { icon: Edit, title: "Magic Add", text: "Type or say “DBMS assignment tomorrow 5pm” or “gym every Monday at 7am”. GetRemindMe's own rules fill in the title, schedule and category. No AI service is involved." },
  { icon: Repeat, title: "Specific, daily and weekly", text: "One-time deadlines, or repeats every day or on chosen weekdays, delivered through browser push and Telegram." },
  { icon: Lock, title: "Private by design", text: "Reminder titles, notes and categories are encrypted before they are stored, and unsafe content is screened out automatically." },
  { icon: Smartphone, title: "Installable and offline", text: "Add it to your home screen, or use the Android app. Changes are saved on your device first and synced when you are online." },
];

const LINKS = [
  { href: SITE.repoUrl, external: true, icon: Code, title: "Source repository", text: "Code, architecture and releases on GitHub" },
  { href: mailto("Hello from the GetRemindMe site"), icon: Mail, title: "Contact the developer", text: "Collaborations, enquiries and feedback" },
  { href: mailto("Bug Report - GetRemindMe App"), icon: Bug, title: "Report an issue", text: "File a bug report or request a feature" },
];

export default function About() {
  const status = useApiHealth();
  usePageMeta(routeMeta("/about"));

  return (
    <SiteLayout>
      <section className="rs-page-head">
        <div className="rs-wrap">
          <span className="rs-eyebrow">
            <b>About</b> {APP_VERSION}
          </span>
          <h1>A reminder service built to remove friction.</h1>
          <p className="rs-lede">
            GetRemindMe began as a student productivity project. It sends specific, daily and weekly reminders through browser push and Telegram, and lets you add them just by typing or speaking.
          </p>
          <div className="rs-cta-row" style={{ alignItems: "center" }}>
            <span className="rs-status" data-s={status} role="status">
              <i /> {STATUS[status] || STATUS.checking}
            </span>
          </div>
        </div>
      </section>

      <div className="rs-page-body">
        <div className="rs-wrap" style={{ display: "grid", gap: 56 }}>
          <div>
            <h2 style={{ fontSize: 30, marginBottom: 22 }}>What&apos;s inside</h2>
            <div className="rs-grid-2">
              {FEATURES.map(({ icon: Icon, title, text }) => (
                <article key={title} className="rs-card">
                  <span className="rs-card-ic">
                    <Icon size={22} />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
              <article className="rs-card" style={{ gridColumn: "1 / -1", background: "var(--rs-gold-soft)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 18 }}>
                <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                  <span className="rs-card-ic" style={{ background: "var(--rs-card)" }}>
                    <Send size={22} />
                  </span>
                  <div>
                    <h3 style={{ margin: 0 }}>Telegram reminders</h3>
                    <p>Deadline alerts in the Telegram app, even when the website is closed.</p>
                  </div>
                </div>
                <Link to="/telegram-setup" className="rs-btn rs-btn--ink rs-btn--small">
                  Set up Telegram <ArrowRight size={16} />
                </Link>
              </article>
            </div>
          </div>

          <div>
            <h2 style={{ fontSize: 30, marginBottom: 22 }}>Project and support</h2>
            <div className="rs-rowlinks">
              {LINKS.map(({ href, external, icon: Icon, title, text }) => (
                <a key={title} href={href} className="rs-rowlink" {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                  <span style={{ display: "flex", alignItems: "center", gap: 16 }}>
                    <span className="rs-card-ic" style={{ background: "var(--rs-card)" }}>
                      <Icon size={22} />
                    </span>
                    <span>
                      <b>{title}</b>
                      <span>{text}</span>
                    </span>
                  </span>
                  <ExternalLink size={20} />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
