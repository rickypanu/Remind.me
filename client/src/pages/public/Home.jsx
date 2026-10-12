import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight, Send, Mic, Clock, Check, Repeat, Bell,
  Keyboard, ClipboardList, Sparkles, Download,
} from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";

/* ---------------------------------------------------------------
   Tiny natural-language parser, runs fully in the browser so
   visitors can try the product without signing up.
---------------------------------------------------------------- */
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WD_RE = "(sunday|monday|tuesday|wednesday|thursday|friday|saturday)";

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function nextWeekday(from, idx, includeToday) {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  let diff = (idx - d.getDay() + 7) % 7;
  if (diff === 0 && !includeToday) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function parseReminder(raw) {
  const original = (raw || "").trim();
  if (!original) return null;

  let t = " " + original + " ";
  const strip = (re) => { t = t.replace(re, " "); };
  const now = new Date();
  const eveningWords = /\b(tonight|evening|night)\b/i.test(t);

  let repeat = "Once";
  let day = null;
  let hour = null;
  let minute = 0;
  let relDate = null;
  let m;

  // Repeats
  if ((m = t.match(new RegExp(`\\bevery ${WD_RE}s?\\b`, "i")))) {
    const idx = WEEKDAYS.indexOf(m[1].toLowerCase());
    day = nextWeekday(now, idx, true);
    repeat = `Weekly, ${cap(m[1].slice(0, 3).toLowerCase())}`;
    strip(m[0]);
  } else if ((m = t.match(/\b(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)? of every month\b/i))) {
    const dom = +m[1];
    day = new Date(now.getFullYear(), now.getMonth(), dom);
    if (day < new Date(now.getFullYear(), now.getMonth(), now.getDate())) day = new Date(now.getFullYear(), now.getMonth() + 1, dom);
    repeat = "Monthly";
    strip(m[0]);
  } else if (/\b(every month|monthly)\b/i.test(t)) {
    repeat = "Monthly";
    strip(/\b(every month|monthly)\b/gi);
  } else if (/\b(every day|everyday|daily|every morning|every evening|every night)\b/i.test(t)) {
    repeat = "Daily";
    strip(/\b(every day|everyday|daily)\b/gi);
    strip(/\bevery\b/gi);
  }

  // Relative: "in 10 minutes"
  if ((m = t.match(/\bin (\d+)\s*(minutes?|mins?|hours?|hrs?|days?)\b/i))) {
    const n = +m[1];
    const u = m[2].toLowerCase();
    const ms = u.startsWith("m") ? n * 60000 : u.startsWith("h") ? n * 3600000 : n * 86400000;
    relDate = new Date(now.getTime() + ms);
    strip(m[0]);
  }

  // Day
  if (!day && !relDate) {
    if (/\btomorrow\b/i.test(t)) {
      day = new Date(now); day.setDate(day.getDate() + 1); day.setHours(0, 0, 0, 0);
      strip(/\btomorrow\b/gi);
    } else if ((m = t.match(new RegExp(`\\b(?:on |next |this )?${WD_RE}\\b`, "i")))) {
      day = nextWeekday(now, WEEKDAYS.indexOf(m[1].toLowerCase()), false);
      strip(m[0]);
    } else if ((m = t.match(/\b(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/i))) {
      const dom = +m[1];
      day = new Date(now.getFullYear(), now.getMonth(), dom);
      if (day < new Date(now.getFullYear(), now.getMonth(), now.getDate())) day = new Date(now.getFullYear(), now.getMonth() + 1, dom);
      strip(m[0]);
    } else if (/\b(today|tonight)\b/i.test(t)) {
      day = new Date(now); day.setHours(0, 0, 0, 0);
      strip(/\btoday\b/gi);
    }
  }

  // Time
  if (!relDate) {
    let tm = t.match(/\b(?:at |@ ?)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
    if (!tm) tm = t.match(/\bat (\d{1,2})(?::(\d{2}))?\b/i);
    if (!tm) tm = t.match(/\b(\d{1,2}):(\d{2})\b/);
    if (tm) {
      let h = +tm[1];
      minute = +(tm[2] || 0);
      const mer = (tm[3] || "").toLowerCase();
      if (mer === "pm" && h < 12) h += 12;
      else if (mer === "am" && h === 12) h = 0;
      else if (!mer && h >= 1 && h <= 6) h += 12;
      else if (!mer && h >= 7 && h <= 11 && eveningWords) h += 12;
      hour = h;
      strip(tm[0]);
    } else if (/\bnoon\b/i.test(t)) { hour = 12; }
    else if (/\bmorning\b/i.test(t)) { hour = 9; }
    else if (/\bafternoon\b/i.test(t)) { hour = 14; }
    else if (/\bevening\b/i.test(t)) { hour = 18; }
    else if (/\btonight\b/i.test(t)) { hour = 20; }
    else if (/\bnight\b/i.test(t)) { hour = 21; }
  }

  // Task text
  strip(/\b(this )?(morning|afternoon|evening|tonight|night|noon|tomorrow|today)\b/gi);
  t = t.trim().replace(/^(please\s+)?(remind me\s+(to|about|that)?\s*|reminder\s+(to|for)?\s*|to\s+)/i, "");
  for (let i = 0; i < 4; i++) {
    t = t.replace(/^(at|on|in|by|every|next|this|the|and)\s+/i, "").replace(/\s+(at|on|in|by|every|next|this|the|and)$/i, "");
  }
  const task = cap(t.replace(/\s+/g, " ").trim()) || "Reminder";

  // Build date
  let date;
  let defaulted = false;
  let note = "";
  if (relDate) {
    date = relDate;
  } else if (hour === null && !day && repeat === "Once") {
    date = new Date(now.getTime() + 3600000);
    date.setMinutes(0, 0, 0);
    defaulted = true;
  } else {
    date = day ? new Date(day) : new Date(now);
    date.setHours(hour === null ? 9 : hour, minute, 0, 0);
    if (hour === null) defaulted = true;
    if (date <= now) {
      date.setDate(date.getDate() + (repeat.startsWith("Weekly") ? 7 : 1));
      note = "That time has already passed, so this is set for the next one.";
    }
  }
  return { task, date, repeat, defaulted, note };
}

const fmtTime = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
function fmtWhen(d) {
  const now = new Date();
  const tmr = new Date(now); tmr.setDate(now.getDate() + 1);
  let day;
  if (d.toDateString() === now.toDateString()) day = "Today";
  else if (d.toDateString() === tmr.toDateString()) day = "Tomorrow";
  else day = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
  return `${day}, ${fmtTime(d)}`;
}
function relIn(d) {
  const mins = Math.round((d - new Date()) / 60000);
  if (mins < 1) return "any moment now";
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const r = mins % 60;
  if (h < 24) return `in ${h}h${r ? ` ${r}m` : ""}`;
  const days = Math.round(h / 24);
  return `in ${days} day${days > 1 ? "s" : ""}`;
}

const pad = (n) => String(n).padStart(2, "0");
const toDateInput = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeInput = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/* --------------------------------------------------------------- */

const MODES = [
  { id: "type", label: "Type", icon: Keyboard },
  { id: "speak", label: "Speak", icon: Mic },
  { id: "form", label: "Form", icon: ClipboardList },
];

const PLACEHOLDERS = [
  "Remind me to push code at 6 PM",
  "Call mom tomorrow morning",
  "Pay rent on the 1st of every month",
  "Gym every Friday at 7 AM",
  "Take medicine in 30 minutes",
];

const CHIPS = ["Call mom tomorrow morning", "Submit report Friday 5 pm", "Drink water in 10 minutes", "Gym every Monday at 7 am"];

const AUTO_MSGS = [
  { when: "8:00 AM, every morning", text: "Morning. You have 3 things today: push code, call mom, send invoice." },
  { when: "2 days before a due date", text: "Rent is due on the 1st. Want an extra reminder the day before?", actions: ["Yes", "No"] },
  { when: "When a task is still open", text: "Did you push the code? Reply Done, or I'll check again in an hour.", actions: ["Done", "Snooze 1h"] },
];

// Web app install (PWA). Needs a web manifest + service worker in your project.
function useInstall() {
  const [evt, setEvt] = useState(null);
  const [installed, setInstalled] = useState(false);
  useEffect(() => {
    const standalone =
      (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone;
    if (standalone) setInstalled(true);
    const onPrompt = (e) => { e.preventDefault(); setEvt(e); };
    const onInstalled = () => { setInstalled(true); setEvt(null); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  const install = async () => {
    if (!evt) return;
    evt.prompt();
    await evt.userChoice;
    setEvt(null);
  };
  return { canPrompt: !!evt, installed, install };
}

function InstallButton() {
  const { canPrompt, installed, install } = useInstall();
  const [help, setHelp] = useState(false);
  if (installed) return null;
  return (
    <div className="flex flex-col items-center md:items-start">
      <button
        type="button"
        onClick={() => (canPrompt ? install() : setHelp(!help))}
        className="inline-flex items-center gap-2.5 px-5 py-3 rounded-2xl font-semibold bg-white hover:bg-slate-50 text-[#1E293B] border border-slate-300 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
      >
        <Download size={18} /> Install web app
      </button>
      {help && !canPrompt && (
        <ul className="mt-3 text-sm leading-relaxed space-y-1 text-left max-w-xs text-slate-600">
          <li><strong>iPhone (Safari):</strong> tap Share, then Add to Home Screen.</li>
          <li><strong>Android (Chrome):</strong> open the menu, then Install app.</li>
          <li><strong>Desktop:</strong> click the install icon in the address bar.</li>
        </ul>
      )}
    </div>
  );
}

function PushBanner({ title = "TaskBot", body, time = "now" }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-white border border-slate-200 px-3.5 py-3 shadow-sm">
      <span className="w-8 h-8 rounded-lg bg-[#DBEAFE] text-[#2563EB] flex items-center justify-center flex-shrink-0">
        <Bell size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex justify-between text-xs">
          <span className="font-bold text-slate-800">{title}</span>
          <span className="text-slate-500">{time}</span>
        </div>
        <p className="text-[13px] text-slate-700 leading-snug mt-0.5">{body}</p>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("type");
  const [text, setText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [, setTick] = useState(0);

  const initDate = new Date(Date.now() + 3600000);
  const [form, setForm] = useState({ task: "", date: toDateInput(initDate), time: toTimeInput(new Date(initDate.setMinutes(0))), repeat: "Once" });

  const [listening, setListening] = useState(false);
  const [voiceErr, setVoiceErr] = useState("");
  const recRef = useRef(null);

  const [test, setTest] = useState("idle"); // idle | waiting | done
  const [testNote, setTestNote] = useState("");

  useEffect(() => {
    const a = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 2600);
    const b = setInterval(() => setTick((n) => n + 1), 30000);
    return () => { clearInterval(a); clearInterval(b); if (recRef.current) recRef.current.abort(); };
  }, []);

  // Current result
  let result = null;
  if (mode === "form") {
    const d = new Date(`${form.date}T${form.time}`);
    if (form.task.trim() && !isNaN(d)) {
      result = { task: cap(form.task.trim()), date: d, repeat: form.repeat, defaulted: false, note: d <= new Date() ? "That time is in the past. Pick a later time." : "" };
    }
  } else {
    result = parseReminder(text);
  }

  const toggleListen = () => {
    setVoiceErr("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceErr("Voice input isn't supported in this browser. Try Chrome, or use the Type tab.");
      return;
    }
    if (listening && recRef.current) { recRef.current.stop(); return; }
    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = true;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => { setListening(false); setVoiceErr("Couldn't hear you. Check mic permission, or type instead."); };
    recRef.current = r;
    setText("");
    r.start();
    setListening(true);
  };

  const sendTest = async () => {
    if (!result) return;
    setTestNote("");
    setTest("waiting");
    let granted = false;
    try {
      if ("Notification" in window) {
        let perm = Notification.permission;
        if (perm === "default") perm = await Notification.requestPermission();
        granted = perm === "granted";
      }
    } catch (e) { /* ignore */ }
    if (!granted) setTestNote("Browser notifications are off, so here's a preview of how it would look.");
    setTimeout(() => {
      const body = `Time for: ${result.task}`;
      if (granted) { try { new Notification("TaskBot", { body }); } catch (e) { /* ignore */ } }
      setTest("done");
    }, 3500);
  };

  const saveAndSignUp = () => {
    if (result) {
      try {
        sessionStorage.setItem(
          "pendingReminder",
          JSON.stringify({ task: result.task, when: result.date.toISOString(), repeat: result.repeat, via: mode })
        );
      } catch (e) { /* ignore */ }
    }
    navigate("/register");
  };

  return (
    <div className="home-root min-h-screen w-full bg-[#F6FAFF] text-[#1E293B] antialiased overflow-x-hidden flex flex-col">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,700;12..96,800&display=swap');
        .home-root { font-family: 'Bricolage Grotesque', ui-sans-serif, system-ui, sans-serif; }
        @keyframes wave { 0%, 100% { height: 6px; } 50% { height: 26px; } }
        @keyframes pop { from { opacity: 0; transform: translateY(8px) scale(.98); } to { opacity: 1; transform: none; } }
        .bar { width: 4px; border-radius: 9999px; background: #229ED9; animation: wave 1s ease-in-out infinite; }
        .pop { animation: pop .35s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .bar, .pop { animation: none; } }
      `,
        }}
      />

      <Header />

      <main className="flex-grow">
        {/* Hero + live try-it */}
        <div className="bg-gradient-to-b from-[#E6F0FF] to-[#F6FAFF]">
        <section className="max-w-3xl mx-auto px-6 pt-14 pb-20 md:pt-20 md:pb-28 text-center">
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-[1.05]">
            Tell it what to remember.
            <br />
            It nudges you <span className="text-[#2563EB]">on time.</span>
          </h1>
          <p className="mt-5 text-lg md:text-xl text-slate-600 max-w-xl mx-auto leading-relaxed">
            Try it right here. No signup. Type, speak or fill a form, then send yourself a real test notification.
          </p>

          <div className="mt-10 rounded-[2rem] bg-white border border-slate-200 p-4 md:p-6 text-left shadow-[0_30px_80px_-30px_rgba(15,27,45,0.35)]">
            {/* Tabs */}
            <div role="tablist" aria-label="How you add a reminder" className="grid grid-cols-3 gap-1 p-1 rounded-full bg-[#EEF4FB] mb-5">
              {MODES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={mode === id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={`inline-flex items-center justify-center gap-1.5 py-2.5 rounded-full text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 ${
                    mode === id ? "bg-white text-[#2563EB] shadow-sm" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            {/* Type */}
            {mode === "type" && (
              <div>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={PLACEHOLDERS[phIdx]}
                  aria-label="Type your reminder"
                  className="w-full rounded-2xl bg-[#EEF4FB] px-5 py-4 text-lg font-medium placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-sky-200"
                />
                {!text && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="text-sm text-slate-500 py-1.5">Try:</span>
                    {CHIPS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setText(c)}
                        className="px-3.5 py-1.5 rounded-full text-sm font-semibold border border-slate-200 text-slate-700 hover:border-[#229ED9] hover:text-[#1E293B] transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Speak */}
            {mode === "speak" && (
              <div className="flex flex-col items-center gap-4 py-2">
                <button
                  type="button"
                  onClick={toggleListen}
                  aria-label={listening ? "Stop listening" : "Start listening"}
                  className={`w-20 h-20 rounded-full flex items-center justify-center text-white transition-all focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300 ${
                    listening ? "bg-[#0D9488] ring-8 ring-teal-100" : "bg-[#2563EB] hover:bg-[#1D4ED8]"
                  }`}
                >
                  <Mic size={28} />
                </button>
                {listening ? (
                  <div className="flex items-center gap-1 h-7" aria-hidden="true">
                    {[0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2, 0.35, 0.12].map((d, i) => (
                      <span key={i} className="bar" style={{ animationDelay: `${d}s` }} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Tap and say: "Remind me to call mom tomorrow at 9"</p>
                )}
                <p className="min-h-[1.75rem] text-lg font-medium text-center break-words">{text}</p>
                {voiceErr && <p className="text-sm text-rose-600 text-center">{voiceErr}</p>}
              </div>
            )}

            {/* Form */}
            {mode === "form" && (
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-sm font-semibold text-slate-600">
                  Task
                  <input
                    type="text"
                    value={form.task}
                    onChange={(e) => setForm({ ...form, task: e.target.value })}
                    placeholder="What should I remind you about?"
                    className="mt-1 w-full rounded-xl bg-[#EEF4FB] px-4 py-3 text-base font-medium text-[#1E293B] placeholder:text-slate-400 focus:outline-none focus:ring-4 focus:ring-sky-200"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-600">
                  Date
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-[#EEF4FB] px-4 py-3 text-base font-medium text-[#1E293B] focus:outline-none focus:ring-4 focus:ring-sky-200"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-600">
                  Time
                  <input
                    type="time"
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-[#EEF4FB] px-4 py-3 text-base font-medium text-[#1E293B] focus:outline-none focus:ring-4 focus:ring-sky-200"
                  />
                </label>
                <label className="col-span-2 text-sm font-semibold text-slate-600">
                  Repeat
                  <select
                    value={form.repeat}
                    onChange={(e) => setForm({ ...form, repeat: e.target.value })}
                    className="mt-1 w-full rounded-xl bg-[#EEF4FB] px-4 py-3 text-base font-medium text-[#1E293B] focus:outline-none focus:ring-4 focus:ring-sky-200"
                  >
                    {["Once", "Daily", "Weekly", "Monthly"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
              </div>
            )}

            {/* Result */}
            {result && (
              <div key={result.task + result.date.getTime()} className="pop mt-5" aria-live="polite">
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 p-4">
                  <span className="w-6 h-6 rounded-full border-2 border-[#229ED9] flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-lg leading-tight break-words">{result.task}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold bg-[#FFE27A] text-[#3b2f00] px-2.5 py-0.5 rounded-full">
                        <Clock size={13} /> {fmtWhen(result.date)}
                      </span>
                      <span className="text-sm font-medium text-slate-500">{relIn(result.date)}</span>
                      {result.repeat !== "Once" && (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#229ED9]">
                          <Repeat size={13} /> {result.repeat}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="ml-auto hidden sm:inline-flex text-xs font-semibold text-emerald-700 items-center gap-1">
                    <Check size={14} /> Understood
                  </span>
                </div>
                {(result.defaulted || result.note) && (
                  <p className="mt-2 text-sm text-slate-500">
                    {result.note || "No time found, so I picked a default. Add something like \"at 6 pm\" to change it."}
                  </p>
                )}

                <div className="mt-4 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={saveAndSignUp}
                    className="flex-1 bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-6 py-3.5 rounded-full font-semibold inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                  >
                    <Send size={16} /> Send this to my Telegram
                  </button>
                  <button
                    type="button"
                    onClick={sendTest}
                    disabled={test === "waiting"}
                    className="flex-1 bg-white border border-slate-300 hover:border-slate-500 disabled:opacity-60 text-[#1E293B] px-6 py-3.5 rounded-full font-semibold inline-flex items-center justify-center gap-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                  >
                    <Bell size={16} /> {test === "waiting" ? "Sending in a few seconds…" : "Test a notification now"}
                  </button>
                </div>

                {test === "done" && (
                  <div className="pop mt-4 rounded-2xl bg-[#E4EFFC] p-3">
                    <PushBanner body={`Time for: ${result.task}`} />
                    <p className="mt-2 px-1 text-sm text-slate-600">
                      {testNote || "That's what it looks like. Create a free account to get it at the real time."}
                    </p>
                  </div>
                )}
                <p className="mt-3 text-xs text-slate-500">A free account is only needed to save it and deliver it later.</p>
              </div>
            )}
          </div>
        </section>
        </div>

        {/* Autonomous messages */}
        <section className="bg-white border-y border-slate-200">
          <div className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-20 md:py-24 lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
            <div className="mb-12 lg:mb-0">
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-[#229ED9]">
                <Sparkles size={16} /> Autonomous messages
              </p>
              <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">It messages you first.</h2>
              <p className="mt-4 text-slate-600 text-lg max-w-md leading-relaxed">
                You don't have to ask. TaskBot sends a morning summary, a heads-up before something is due, and a follow-up when a task is still open.
              </p>
            </div>

            <div className="rounded-[2rem] bg-[#E4EFFC] p-5 md:p-6 space-y-5">
              {AUTO_MSGS.map((m) => (
                <div key={m.when}>
                  <p className="text-xs font-semibold text-slate-600 mb-2 ml-1">{m.when}</p>
                  <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 shadow-sm max-w-[92%]">
                    <p className="text-[15px] text-slate-800 leading-snug">{m.text}</p>
                    {m.actions && (
                      <div className="mt-3 flex gap-2">
                        {m.actions.map((a) => (
                          <span key={a} className="px-3 py-1 rounded-full bg-[#EEF4FB] border border-slate-200 text-xs font-semibold text-slate-700">{a}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Channels */}
        <section className="max-w-7xl mx-auto px-6 md:px-12 lg:px-20 py-20 md:py-24 lg:grid lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
          <div className="mb-10 lg:mb-0">
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Reaches you where you already look.</h2>
            <p className="mt-4 text-slate-600 text-lg max-w-md leading-relaxed">
              Get a push notification from the web app, a message in Telegram, or both.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-3xl bg-white border border-slate-200 p-6">
              <p className="font-bold text-lg mb-4">Push notification</p>
              <PushBanner body="Review deployment logs. Scheduled for 2:00 PM." time="2:00 PM" />
              <p className="mt-4 text-sm text-slate-600">Works on phone and desktop once you install the web app.</p>
            </div>
            <div className="rounded-3xl bg-white border border-slate-200 p-6">
              <p className="font-bold text-lg mb-4">Telegram</p>
              <div className="rounded-2xl bg-[#E4EFFC] p-3">
                <div className="rounded-2xl rounded-tl-sm bg-white px-3.5 py-2.5 text-[13px] shadow-sm inline-block">
                  <span className="block text-xs font-bold text-[#229ED9] mb-0.5">TaskBot</span>
                  It's 2:00 PM. Time to review those deployment logs.
                </div>
              </div>
              <p className="mt-4 text-sm text-slate-600">No app needed. Connect your Telegram once.</p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 md:px-12 lg:px-20 pb-24">
          <div className="max-w-7xl mx-auto rounded-[2rem] bg-gradient-to-br from-[#DBEAFE] via-[#E0F2FE] to-[#D1FAE5] border border-sky-100 text-[#1E293B] px-8 py-14 md:px-16 md:py-20 text-center md:text-left md:flex md:items-center md:justify-between gap-10">
            <div>
              <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">Liked what you tried?</h2>
              <p className="mt-3 text-slate-600 text-lg max-w-md mx-auto md:mx-0">Create a free account and your first reminder is live in under a minute.</p>
            </div>
            <div className="mt-8 md:mt-0 flex flex-col gap-4 items-center md:items-start flex-shrink-0">
              <Link to="/register">
                <button
                  type="button"
                  className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white px-8 py-4 rounded-full font-bold text-lg inline-flex items-center gap-2 transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-sky-300"
                >
                  Create free account <ArrowRight size={18} />
                </button>
              </Link>
              <InstallButton />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}