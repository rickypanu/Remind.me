import React, { useMemo, useRef, useState } from "react";
import { Sparkles, ArrowUp, Mic, MicOff, CalendarClock, Repeat } from "lucide-react";
import useAutosizeTextarea from "../../hooks/useAutosizeTextarea";
import useQuickAdd from "../../hooks/useQuickAdd";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";
import { feedback } from "../../feedback/feedback";
import notify from "../../utils/notify";
import { describeScheduleLocal, formatDueIst } from "../../utils/date";
import { parseQuick } from "../../utils/quickParse";
import { useI18n } from "../../i18n/index.jsx";

const VOICE_LANG = "en-IN";
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
export default function MagicAddForm({ isOffline }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const { add } = useQuickAdd();
  useAutosizeTextarea(inputRef, text);

  const { listening, toggle } = useSpeechRecognition({
    lang: VOICE_LANG,
    getBaseText: () => text,
    onText: setText,
    onUnsupported: () =>
      notify.error(t("Voice input is not supported in this browser. Try Chrome, or type your reminder instead.")),
    onError: () => notify.error(t("Couldn't use the microphone. Allow mic access in your browser settings and try again.")),
  });

  // Live preview of what will be saved (cheap: it is plain string work)
  const preview = useMemo(() => (text.trim() ? parseQuick(text) : null), [text]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    try {
      const result = await add(trimmed);
      if (!result) return;
      setText(""); // clear first: the reminder is already saved on this device
      feedback.added();
      notify.success(`${t("Added")} · ${whenLabel(result.parsed.payload)}${navigator.onLine ? "" : " (" + t("saved offline") + ")"}`);
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
        className={`rm-ios-card relative flex items-end gap-2 rounded-[24px] border bg-white p-2 pl-4 transition-[border-color,box-shadow] duration-200 ${
          listening ? "border-red-300 ring-4 ring-red-500/10" : "border-slate-200 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-500/10"
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
        {preview ? (
          <p className="flex min-w-0 items-center gap-2 text-[13px] font-semibold text-slate-700">
            {preview.payload.schedule_type === "once" ? (
              <CalendarClock size={15} strokeWidth={2.4} className="shrink-0 text-blue-600" aria-hidden="true" />
            ) : (
              <Repeat size={15} strokeWidth={2.4} className="shrink-0 text-blue-600" aria-hidden="true" />
            )}
            <span className="min-w-0 truncate">
              <span className="text-slate-900">{preview.payload.title}</span> · {whenLabel(preview.payload)}
            </span>
          </p>
        ) : (
          <div className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setText(example);
                  inputRef.current?.focus();
                }}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition-colors hover:border-blue-300 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
              >
                {example}
              </button>
            ))}
          </div>
        )}
        {isOffline && !preview && (
          <p className="mt-1.5 text-[12px] font-semibold text-amber-700">{t("Offline: reminders are saved on this phone and upload later.")}</p>
        )}
      </div>
    </form>
  );
}
