import React, { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, ArrowUp, Mic, MicOff, CalendarClock, Repeat } from "../../components/icons";
import useAutosizeTextarea from "../../hooks/useAutosizeTextarea";
import useQuickAdd from "../../hooks/useQuickAdd";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";
import { feedback } from "../../feedback/feedback";
import notify from "../../utils/notify";
import { describeScheduleLocal, formatDueIst } from "../../utils/date";
import { parseQuick, TIME_CHIPS } from "../../utils/quickParse";
import { useI18n } from "../../i18n/index.jsx";
import { dateLocale } from "../../i18n/languages";
import { deleteTask, editTask } from "../../offline/taskStore";
import EditReminderDialog from "../../components/EditReminderDialog";

// The microphone listens in the language chosen for the website (Hinglish is Hindi spoken, so it uses the Hindi model).
const voiceLang = (lang) => (lang === "en" ? "en-IN" : lang === "hinglish" ? "hi-IN" : dateLocale(lang));
const MAX_LENGTH = 500;
const EXAMPLES = ["Gym tomorrow 7am", "Call mom in 30 min", "Revise every day 8pm", "kal sham 6 baje assignment"];

/** What the reminder will say, e.g. "31 Oct, 6:00 pm" or "Every Mon, Thu at 7:00 AM". */
function whenLabel(payload) {
  if (payload.schedule_type === "once") return `${formatDueIst(payload.due_date)} IST`;
  return describeScheduleLocal(payload.schedule_type, payload.time_of_day, payload.weekdays);
}

/**
 * "Type or speak a reminder" box on the dashboard. The sentence is understood on the phone and saved at once
 * (see hooks/useQuickAdd.js), so it works in about a second, even offline or while the server is waking up.
 */
export default function MagicAddForm({ isOffline, titles = [] }) {
  const { t, lang } = useI18n();
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const { add, habits } = useQuickAdd();
  const [added, setAdded] = useState(null); // the reminder just saved, so it can be undone or fixed for a few seconds
  const [editing, setEditing] = useState(null);
  useEffect(() => {
    if (!added) return undefined;
    const id = setTimeout(() => setAdded(null), 8000);
    return () => clearTimeout(id);
  }, [added]);
  useAutosizeTextarea(inputRef, text);

  const { listening, toggle } = useSpeechRecognition({
    lang: voiceLang(lang),
    getBaseText: () => text,
    onText: setText,
    onUnsupported: () =>
      notify.error(t("Voice input is not supported in this browser. Try Chrome, or type your reminder instead.")),
    onError: () => notify.error(t("Couldn't use the microphone. Allow mic access in your browser settings and try again.")),
  });

  // Live preview of what will be saved (cheap: it is plain string work)
  const suggestions = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (q.length < 2 || q.length > 40) return [];
    return titles.filter((x) => x.toLowerCase().startsWith(q) && x.toLowerCase() !== q).slice(0, 3);
  }, [text, titles]);
  const preview = useMemo(() => (text.trim() ? parseQuick(text, Date.now(), habits) : null), [text, habits]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      const result = await add(trimmed);
      if (!result) return;
      setText(""); // clear first: the reminder is already saved on this device
      feedback.added();
      setAdded({ task: result.task, label: whenLabel(result.parsed.payload), assumed: result.parsed.assumedTime });
      inputRef.current?.focus({ preventScroll: true });
    } catch (err) {
      console.error("Quick add failed:", err);
      notify.error(t("Couldn't save that reminder on this device. Please try again."));
    }
  };

  const placeholder = listening ? t("Listening...") : t("Try “Gym tomorrow 7am”");

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <div
        className={`rm-ios-card relative flex items-end gap-2 rounded-[24px] p-2 pl-4 transition-colors duration-200 ${
          listening ? "bg-red-50" : "bg-white"
        }`}
      >
        <Sparkles className="mb-[15px] shrink-0 text-blue-600" size={20} strokeWidth={2.5} aria-hidden="true" />

        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter saves, Shift+Enter adds a new line
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          aria-label={t("Add a reminder by typing or speaking")}
          placeholder={placeholder}
          maxLength={MAX_LENGTH}
          enterKeyHint="send"
          className="min-h-[48px] min-w-0 flex-1 resize-none bg-transparent py-[11px] text-[16px] font-medium leading-6 text-slate-900 outline-none placeholder:text-slate-500"
        />

        <button
          type="button"
          onClick={toggle}
          aria-label={listening ? t("Stop listening") : t("Speak a reminder")}
          aria-pressed={listening}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-90 ${
            listening ? "animate-pulse bg-red-500 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
          }`}
        >
          {listening ? <MicOff size={19} strokeWidth={2.4} /> : <Mic size={19} strokeWidth={2.4} />}
        </button>

        <button
          type="submit"
          disabled={listening || !text.trim()}
          aria-label={t("Add reminder")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-all duration-200 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-90 disabled:bg-slate-200 disabled:text-slate-500 disabled:shadow-none"
        >
          <ArrowUp size={21} strokeWidth={3} />
        </button>
      </div>

      {/* Live preview, or one-tap examples while the box is empty */}
      <div className="mt-2.5 min-h-[28px] px-1" aria-live="polite">
        {!preview && added ? (
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-700">
            <span className="min-w-0 flex-1 truncate">
              <span data-no-translate className="text-slate-900">{added.task.title}</span> · {added.label}
              {added.assumed ? <span className="font-medium text-slate-500"> · {t("time not given, set by default")}</span> : null}
            </span>
            <button type="button" onClick={async () => { const x = added.task; setAdded(null); await deleteTask(x.id, { silent: true }); }}
              className="shrink-0 rounded-full px-2.5 py-1 text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{t("Undo")}</button>
            <button type="button" onClick={() => { setEditing(added.task); setAdded(null); }}
              className="shrink-0 rounded-full px-2.5 py-1 text-blue-700 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">{t("Edit")}</button>
          </p>
        ) : preview ? (
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-700">
            {preview.payload.schedule_type === "once" ? (
              <CalendarClock size={15} strokeWidth={2.4} className="shrink-0 text-blue-600" aria-hidden="true" />
            ) : (
              <Repeat size={15} strokeWidth={2.4} className="shrink-0 text-blue-600" aria-hidden="true" />
            )}
            <span className="min-w-0 truncate">
              <span className="text-slate-900">{preview.payload.title}</span> · {whenLabel(preview.payload)}
              {preview.assumedTime ? <span className="font-medium text-slate-500"> · {t("time not given, set by default")}</span> : null}
            </span>
          </p>
        ) : (
          <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setText(t(example));
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              >
                {example}
              </button>
            ))}
          </div>
        )}
        {preview && preview.assumedTime && !listening && (
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={t("Pick a time")}>
            {TIME_CHIPS.map((chip) => (
              <button
                key={chip.word}
                type="button"
                onClick={() => { setText(`${text.trim()} ${chip.word}`); inputRef.current?.focus(); }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              >
                {t(chip.label)}
              </button>
            ))}
          </div>
        )}
        {suggestions.length > 0 && !listening && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((x) => (
              <button
                key={x}
                type="button"
                data-no-translate
                onClick={() => { setText(`${x} `); inputRef.current?.focus(); }}
                className="max-w-[240px] truncate rounded-full bg-blue-50 px-3 py-1.5 text-[12.5px] font-semibold text-blue-700 hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              >
                {x}
              </button>
            ))}
          </div>
        )}
        {editing && <EditReminderDialog task={editing} onClose={() => setEditing(null)} onSave={editTask} />}
        {isOffline && !preview && (
          <p className="mt-1.5 text-[12px] font-semibold text-amber-700">{t("Offline: reminders are saved on this phone and upload later.")}</p>
        )}
      </div>
    </form>
  );
}
