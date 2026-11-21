import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, ClipboardList, Clock, Keyboard, Mic, Repeat, Send } from "../icons";
import { describeScheduleLocal, formatDueIst, getIstNowInputValue, getRelativeTime, istInputToUtcIso } from "../../utils/date";
import { parseQuick } from "../../utils/quickParse";

const MODES = [
  { id: "type", label: "Type", icon: Keyboard },
  { id: "speak", label: "Speak", icon: Mic },
  { id: "form", label: "Form", icon: ClipboardList },
];
const PLACEHOLDERS = ["Remind me to push code at 6 PM", "Call mom tomorrow morning", "Pay rent on the 1st", "Gym every Friday at 7 AM", "Take medicine in 30 minutes"];
const CHIPS = ["Call mom tomorrow morning", "Submit report Friday 5 pm", "Drink water in 10 minutes", "Gym every Monday at 7 am"];
export const PENDING_KEY = "pendingReminder";

const IST_MS = 330 * 60 * 1000;
const istWeekday = (iso) => (new Date(new Date(iso).getTime() + IST_MS).getUTCDay() + 6) % 7; // 0 = Monday

/** The reminder a visitor typed, as the same payload the dashboard's quick add creates. */
function payloadFromForm({ task, date, time, repeat }) {
  const title = task.trim();
  if (!title) return null;
  const iso = istInputToUtcIso(`${date}T${time}`);
  if (!iso) return null;
  if (repeat === "once") return { title, schedule_type: "once", due_date: iso, description: null, category: "Other" };
  const base = { title, schedule_type: repeat, time_of_day: time, description: null, category: "Other" };
  return repeat === "weekly" ? { ...base, weekdays: [istWeekday(iso)] } : base;
}

function whenOf(p) {
  return p.schedule_type === "once" ? `${formatDueIst(p.due_date)} IST` : describeScheduleLocal(p.schedule_type, p.time_of_day, p.weekdays);
}

export function PushBanner({ title = "GetRemindMe", body, time = "now" }) {
  return (
    <div className="rs-push">
      <span className="rs-push-ic">
        <Bell size={17} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="rs-push-top">
          <b>{title}</b>
          <small>{time}</small>
        </div>
        <p>{body}</p>
      </div>
    </div>
  );
}

/** The live demo in the hero: type, speak or fill a form, see how it is understood, send a real test notification. */
export default function TryIt() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("type");
  const [text, setText] = useState("");
  const [phIdx, setPhIdx] = useState(0);
  const [, setTick] = useState(0);
  const initial = getIstNowInputValue(Date.now() + 3600000);
  const [form, setForm] = useState({ task: "", date: initial.slice(0, 10), time: `${initial.slice(11, 13)}:00`, repeat: "once" });
  const [listening, setListening] = useState(false);
  const [voiceErr, setVoiceErr] = useState("");
  const recRef = useRef(null);
  const [test, setTest] = useState("idle"); // idle | waiting | done
  const [testNote, setTestNote] = useState("");

  useEffect(() => {
    const a = setInterval(() => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length), 2600);
    const b = setInterval(() => setTick((n) => n + 1), 30000);
    return () => {
      clearInterval(a);
      clearInterval(b);
      recRef.current?.abort?.();
    };
  }, []);

  const result = useMemo(() => {
    if (mode === "form") {
      const payload = payloadFromForm(form);
      if (!payload) return null;
      const past = payload.schedule_type === "once" && new Date(payload.due_date) <= new Date();
      return { payload, note: past ? "That time is in the past. Pick a later time." : "" };
    }
    const parsed = text.trim() ? parseQuick(text) : null;
    if (!parsed) return null;
    return {
      payload: parsed.payload,
      note: parsed.assumedTime ? 'No time found, so we picked a sensible default. Add something like "at 6 pm" to set it.' : "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, text, form, Math.floor(Date.now() / 30000)]);

  const toggleListen = () => {
    setVoiceErr("");
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceErr("Voice input isn't supported in this browser. Try Chrome, or use the Type tab.");
      return;
    }
    if (listening && recRef.current) {
      recRef.current.stop();
      return;
    }
    const r = new SR();
    r.lang = "en-IN";
    r.interimResults = true;
    r.onresult = (e) => setText(Array.from(e.results).map((x) => x[0].transcript).join(""));
    r.onend = () => setListening(false);
    r.onerror = () => {
      setListening(false);
      setVoiceErr("Couldn't hear you. Check mic permission, or type instead.");
    };
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
    } catch {
      /* ignore */
    }
    if (!granted) setTestNote("Browser notifications are off, so here's a preview of how it would look.");
    setTimeout(() => {
      if (granted) {
        try {
          new Notification("GetRemindMe", { body: `Time for: ${result.payload.title}` });
        } catch {
          /* ignore */
        }
      }
      setTest("done");
    }, 3500);
  };

  // The dashboard picks this up after sign-up / log-in and adds it to the account (see Dashboard.jsx).
  const saveAndSignUp = () => {
    if (result) {
      try {
        sessionStorage.setItem(PENDING_KEY, JSON.stringify({ payload: result.payload, savedAt: Date.now() }));
      } catch {
        /* storage unavailable: the visitor can still sign up and add it again */
      }
    }
    navigate("/register");
  };

  const p = result?.payload;
  return (
    <div className="rs-try">
      <span className="rs-try-tag">Try it, no sign-up</span>
      <div role="tablist" aria-label="How you add a reminder" className="rs-tabs">
        {MODES.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" type="button" className="rs-tab" aria-selected={mode === id} onClick={() => setMode(id)}>
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>

      {mode === "type" && (
        <div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={PLACEHOLDERS[phIdx]}
            aria-label="Type your reminder"
            className="rs-field"
            maxLength={200}
          />
          {!text && (
            <div className="rs-chips">
              <span>Try:</span>
              {CHIPS.map((c) => (
                <button key={c} type="button" className="rs-chip" onClick={() => setText(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {mode === "speak" && (
        <div className="rs-speak">
          <button type="button" className="rs-mic" onClick={toggleListen} aria-pressed={listening} aria-label={listening ? "Stop listening" : "Start listening"}>
            <Mic size={32} />
          </button>
          {listening ? (
            <div className="rs-wave" aria-hidden="true">
              {[0, 0.15, 0.3, 0.1, 0.25, 0.05, 0.2, 0.35, 0.12].map((d, i) => (
                <i key={i} style={{ animationDelay: `${d}s` }} />
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 14.5, color: "var(--rs-ink-3)" }}>Tap and say: "Remind me to call mom tomorrow at 9"</p>
          )}
          <p style={{ minHeight: "1.75rem", fontSize: 18, fontWeight: 550, overflowWrap: "anywhere" }}>{text}</p>
          {voiceErr && <p style={{ fontSize: 14, color: "#c0392b" }}>{voiceErr}</p>}
        </div>
      )}

      {mode === "form" && (
        <div className="rs-form-grid">
          <label className="rs-span2">
            Task
            <input className="rs-input" type="text" value={form.task} maxLength={200} onChange={(e) => setForm({ ...form, task: e.target.value })} placeholder="What should we remind you about?" />
          </label>
          <label>
            Date
            <input className="rs-input" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </label>
          <label>
            Time
            <input className="rs-input" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
          </label>
          <label className="rs-span2">
            Repeat
            <select className="rs-input" value={form.repeat} onChange={(e) => setForm({ ...form, repeat: e.target.value })}>
              <option value="once">Once</option>
              <option value="daily">Every day</option>
              <option value="weekly">Every week, on that weekday</option>
            </select>
          </label>
        </div>
      )}

      {p && (
        <div className="rs-result" aria-live="polite">
          <div className="rs-result-card">
            <span className="rs-result-dot" />
            <div style={{ minWidth: 0 }}>
              <p className="rs-result-title">{p.title}</p>
              <div className="rs-meta">
                <span className="rs-pill">
                  <Clock size={14} /> {whenOf(p)}
                </span>
                {p.schedule_type === "once" ? (
                  <span>{getRelativeTime(p.due_date).replace("Due ", "")}</span>
                ) : (
                  <span className="rs-pill rs-pill--line">
                    <Repeat size={14} /> Repeats
                  </span>
                )}
                {p.category && p.category !== "Other" && <span className="rs-pill rs-pill--line">{p.category}</span>}
              </div>
            </div>
          </div>
          {result.note && <p className="rs-note">{result.note}</p>}

          <div className="rs-result-actions">
            <button type="button" className="rs-btn rs-btn--gold" onClick={saveAndSignUp}>
              <Send size={17} /> Save it to my account
            </button>
            <button type="button" className="rs-btn rs-btn--line" onClick={sendTest} disabled={test === "waiting"}>
              <Bell size={17} /> {test === "waiting" ? "Sending in a moment…" : "Test a notification"}
            </button>
          </div>

          {test === "done" && (
            <div className="rs-toast">
              <PushBanner body={`Time for: ${p.title}`} />
              <p className="rs-note" style={{ marginTop: 8 }}>
                {testNote || "That's how it arrives. Create a free account to get it at the real time."}
              </p>
            </div>
          )}
          <p className="rs-note">
            <Check size={14} style={{ verticalAlign: "-2px", marginRight: 4 }} />A free account is only needed to save it and deliver it later.
          </p>
        </div>
      )}
    </div>
  );
}
