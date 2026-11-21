import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight, BellRing, ChevronDown, Download, Edit, Lock, Mail, Repeat, Send, Smartphone, Sparkles,
} from "../../components/icons";
import SiteLayout from "../../components/site/SiteLayout";
import TryIt, { PushBanner } from "../../components/site/TryIt";
import usePageMeta from "../../utils/usePageMeta";
import useInstall, { promptInstall } from "../../utils/install";
import { routeMeta } from "../../seo/routes";
import { FAQS } from "../../data/faqs.data";
import { SITE, mailto } from "../../config/site";

const SERVICES = [
  {
    icon: Edit,
    title: "Plain-language reminders",
    text: "Type or say “DBMS assignment tomorrow 5pm”. We pick out the title, date, time and category, in English, Hindi or Hinglish.",
    tags: ["Type", "Voice", "Hinglish"],
  },
  {
    icon: Send,
    title: "Delivery where you already look",
    text: "Alerts reach your phone and laptop through the browser, and your Telegram chat. Use one, or both at once.",
    tags: ["Web Push", "Telegram"],
  },
  {
    icon: BellRing,
    title: "Deadline alerts",
    text: "A heads-up before it is due. Pick 1 day, 3 hours, 1 hour, 10 minutes or 1 minute ahead, separately for each reminder.",
    tags: ["1 day", "1 hour", "10 min", "1 min"],
  },
  {
    icon: Repeat,
    title: "Daily and weekly routines",
    text: "Set a habit once. It repeats every day, or on the weekdays you choose, and rolls forward on its own after each tick.",
    tags: ["Daily", "Weekly", "Weekdays"],
  },
  {
    icon: Lock,
    title: "Private by design",
    text: "Titles, notes and categories are encrypted before they are stored, with a separate key for every user. Unsafe content is screened out.",
    tags: ["AES-256-GCM", "Per-user keys"],
  },
  {
    icon: Smartphone,
    title: "Offline, and installable",
    text: "Everything is saved on your device first and synced when you are back online. Add it to your home screen, or get the Android app.",
    tags: ["Offline first", "Web app", "Android"],
  },
];

const STEPS = [
  {
    title: "Tell us",
    text: "Type it, say it, or use the short form. Your sentence is read on your device in a few milliseconds, so there is nothing to wait for.",
    eg: ["gym every monday and thursday 7am", "Every Mon, Thu at 7:00 AM"],
  },
  {
    title: "Choose where",
    text: "Turn on browser alerts and connect Telegram once. Each channel keeps its own record, so one alert is never sent twice.",
    eg: ["Channels", "Browser alerts + Telegram"],
  },
  {
    title: "We remind you",
    text: "Alerts arrive ahead of the deadline. Tick it done and a repeating reminder rolls to its next time by itself.",
    eg: ["DBMS assignment", "Due in 10 minutes. Time to wrap it up."],
  },
];

const CASES = [
  {
    title: "Students",
    text: "Assignments, labs, vivas and exam weeks, sorted by what is due next.",
    egs: ["DBMS assignment Friday 5pm", "Revise physics every weekday 7pm", "Lab record tomorrow morning"],
  },
  {
    title: "Placements and internships",
    text: "Tests, interview slots and follow-ups that must not slip.",
    egs: ["Online test Sunday 10am", "Send resume to HR by Monday 6pm", "Interview prep every day 8pm"],
  },
  {
    title: "Everyday life",
    text: "Bills, habits and the small things that are easy to forget.",
    egs: ["Pay rent on the 1st", "Gym every Friday 7am", "Call mom in 30 minutes"],
  },
];

const FAQ_IDS = [2, 3, 12, 27];

function InstallAction() {
  const install = useInstall();
  if (!install.canPrompt) return null;
  return (
    <button type="button" className="rs-btn rs-btn--line" onClick={promptInstall}>
      <Download size={18} /> Install web app
    </button>
  );
}

export default function Home() {
  usePageMeta(routeMeta("/"));
  const faqs = FAQ_IDS.map((id) => FAQS.find((f) => f.id === id)).filter(Boolean);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="rs-hero">
        <div className="rs-wrap rs-hero-grid">
          <div>
            <span className="rs-badge">
              <i>
                <BellRing size={14} />
              </i>
              A reminder service for students and busy people
            </span>
            <h1>
              Reminders that reach you <span className="rs-mark-hl">before</span> the deadline does.
            </h1>
            <p className="rs-hero-sub">
              Tell GetRemindMe what to remember in plain words. We read the date, time and repeat, then deliver it to Telegram and your browser, right on schedule.
            </p>
            <div className="rs-cta-row">
              <Link to="/register" className="rs-btn rs-btn--gold">
                Start free <ArrowRight size={18} />
              </Link>
              <a href="#services" className="rs-btn rs-btn--line">
                See the services
              </a>
            </div>
            <ul className="rs-facts">
              <li>
                <Sparkles size={17} /> Free to use
              </li>
              <li>
                <Smartphone size={17} /> Works offline
              </li>
              <li>
                <Lock size={17} /> Encrypted at rest
              </li>
            </ul>
          </div>
          <TryIt />
        </div>
      </section>

      {/* Services */}
      <section id="services" className="rs-sec">
        <div className="rs-wrap">
          <div className="rs-sec-head">
            <span className="rs-eyebrow">
              <b>01</b> Services
            </span>
            <h2 className="rs-h2">What GetRemindMe does for you</h2>
            <p className="rs-lede">Six things, done properly, so a deadline never depends on your memory.</p>
          </div>
          <div className="rs-services">
            {SERVICES.map(({ icon: Icon, title, text, tags }, i) => (
              <article key={title} className="rs-service">
                <div className="rs-service-top">
                  <Icon size={30} strokeWidth={1.7} />
                  <span className="rs-service-num">0{i + 1}</span>
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
                <ul className="rs-tags">
                  {tags.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Process */}
      <section id="how" className="rs-sec rs-sec--paper2">
        <div className="rs-wrap">
          <div className="rs-sec-head">
            <span className="rs-eyebrow">
              <b>02</b> How it works
            </span>
            <h2 className="rs-h2">From a sentence to a nudge, in three steps</h2>
          </div>
          <ol className="rs-steps">
            {STEPS.map(({ title, text, eg }, i) => (
              <li key={title} className="rs-step">
                <span className="rs-step-n">{i + 1}</span>
                <h3>{title}</h3>
                <div>
                  <p>{text}</p>
                  <p className="rs-step-eg">
                    <b>{eg[0]}</b> → {eg[1]}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="rs-sec">
        <div className="rs-wrap">
          <div className="rs-sec-head">
            <span className="rs-eyebrow">
              <b>03</b> Who it&apos;s for
            </span>
            <h2 className="rs-h2">Built around real deadlines</h2>
            <p className="rs-lede">Whatever you are keeping track of, you say it the way you would tell a friend.</p>
          </div>
          <div className="rs-cases">
            {CASES.map(({ title, text, egs }) => (
              <article key={title} className="rs-case">
                <h3>{title}</h3>
                <p>{text}</p>
                <ul className="rs-egs">
                  {egs.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Channels */}
      <section className="rs-sec rs-sec--night">
        <div className="rs-wrap">
          <div className="rs-sec-head">
            <span className="rs-eyebrow">
              <b>04</b> Delivery
            </span>
            <h2 className="rs-h2">It finds you, wherever you are</h2>
            <p className="rs-lede">A push in the browser, a message in Telegram, or an alarm from the Android app. Pick what suits you.</p>
          </div>
          <div className="rs-channels">
            <div className="rs-device">
              <h3>Browser push</h3>
              <PushBanner title="DBMS assignment" body="Due in 1 hour. Time to lock in." time="4:00 PM" />
              <p className="rs-device-note">Works on phone and laptop once you allow notifications or install the web app.</p>
            </div>
            <div className="rs-device">
              <h3>Telegram</h3>
              <div className="rs-chat">
                <div className="rs-bubble">
                  <b>GetRemindMe</b>Due in 10 minutes. &lsquo;DBMS assignment&rsquo; is due in 10 minutes. Time to wrap it up.
                </div>
                <div className="rs-bubble rs-bubble--sched">
                  <b>Today&apos;s check-in</b>You have 3 tasks today. Let&apos;s keep the momentum going.
                </div>
              </div>
              <p className="rs-device-note">No extra app needed. Connect your Telegram once from your dashboard.</p>
            </div>
            <div className="rs-device">
              <h3>Android app</h3>
              <p className="rs-device-note" style={{ color: "#f6f2e9", fontSize: 17 }}>
                Alarm-style alerts with your own sound, a home-screen widget for the next deadline, and full offline use.
              </p>
              <a href={SITE.apkUrl} className="rs-btn rs-btn--gold rs-btn--small" style={{ justifySelf: "start" }}>
                <Download size={17} /> Download the APK
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="rs-sec">
        <div className="rs-wrap rs-split">
          <div className="rs-sec-head" style={{ marginBottom: 0 }}>
            <span className="rs-eyebrow">
              <b>05</b> Questions
            </span>
            <h2 className="rs-h2">Quick answers</h2>
            <p className="rs-lede">The short version. The full list covers notifications, offline use and your account.</p>
            <div style={{ marginTop: 8 }}>
              <Link to="/faqs" className="rs-btn rs-btn--line">
                All FAQs <ArrowRight size={17} />
              </Link>
            </div>
          </div>
          <div className="rs-faq">
            {faqs.map((f) => (
              <details key={f.id}>
                <summary>
                  {f.question} <ChevronDown size={22} />
                </summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section id="contact" className="rs-sec rs-sec--night">
        <div className="rs-wrap rs-close">
          <div>
            <h2>Your next deadline is already on its way.</h2>
            <p className="rs-lede">Create a free account and your first reminder is live in under a minute.</p>
            <div className="rs-cta-row">
              <Link to="/register" className="rs-btn rs-btn--gold">
                Create free account <ArrowRight size={18} />
              </Link>
              <InstallAction />
            </div>
          </div>
          <div className="rs-close-card">
            <Mail size={26} color="#f4b400" />
            <h3 style={{ fontSize: 22 }}>Questions, or something custom?</h3>
            <small>Write to the developer. Feedback, bug reports and ideas are all welcome.</small>
            <a className="rs-mail" href={mailto("Hello from the GetRemindMe site")}>
              {SITE.supportEmail}
            </a>
          </div>
        </div>
      </section>
    </SiteLayout>
  );
}
