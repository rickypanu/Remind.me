import React, { useRef, useState } from "react";
import { Loader2, Sparkles, ArrowUp, Mic, MicOff } from "lucide-react";
import useAutosizeTextarea from "../../hooks/useAutosizeTextarea";
import useMagicAdd from "../../hooks/useMagicAdd";
import useSpeechRecognition from "../../hooks/useSpeechRecognition";
import { feedback } from "../../feedback/feedback";
import notify from "../../utils/notify";

const VOICE_LANG = "en-IN";
const MAX_LENGTH = 500;

/** "Type or speak a reminder" box on the dashboard (server-side AI reads the sentence). */
export default function MagicAddForm({ isOffline }) {
  const [text, setText] = useState("");
  const inputRef = useRef(null);
  const { submit, busy } = useMagicAdd();
  useAutosizeTextarea(inputRef, text);

  const { listening, toggle } = useSpeechRecognition({
    lang: VOICE_LANG,
    getBaseText: () => text,
    onText: setText,
    onUnsupported: () =>
      notify.error("Voice input is not supported in this browser. Try Chrome, or type your reminder instead."),
    onError: () => notify.error("Couldn't use the microphone. Allow mic access in your browser settings and try again."),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    // Smart add asks the server's AI to read the sentence, so it needs a connection.
    if (!navigator.onLine) {
      notify.info("Smart add needs an internet connection. Tap + to add a reminder offline.", { icon: "📴" });
      return;
    }

    try {
      await submit(trimmed);
      setText("");
      feedback.added();
      notify.success("Reminder added.");
    } catch (err) {
      console.error("Magic Add failed:", err);
      // An expired session (401) is handled globally by the API client.
      if (err.response?.status === 401) return;
      // Shows the server's own message (content rejected, AI busy, couldn't parse, offline...)
      notify.error(err, "Couldn't add that reminder. Try rephrasing it.");
    }
  };

  const placeholder = listening
    ? "Listening..."
    : isOffline
      ? "Offline: tap + to add a reminder"
      : "Try “Gym tomorrow 7am”";  // short on purpose: a long hint wraps to 3 lines on a phone

  return (
    <form onSubmit={handleSubmit} className="mb-2 relative group">
      <div className="absolute left-4 top-[18px] flex items-center pointer-events-none">
        <Sparkles className="text-blue-500 group-focus-within:text-blue-600 transition-colors duration-200" size={20} strokeWidth={2.5} aria-hidden="true" />
      </div>

      <textarea
        ref={inputRef}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter adds a new line
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
        disabled={busy}
        aria-label="Add a task by typing or speaking"
        placeholder={placeholder}
        maxLength={MAX_LENGTH}
        className={`block w-full resize-none bg-white text-sm sm:text-[15px] leading-6 text-slate-900 font-medium placeholder:text-slate-500 placeholder:whitespace-nowrap placeholder:overflow-hidden placeholder:text-ellipsis rounded-[20px] border shadow-[0_4px_20px_rgb(0,0,0,0.03)] pl-12 pr-28 py-[18px] min-h-[60px] outline-none transition-[border-color,box-shadow] duration-200 ${
          listening ? "border-red-300 ring-4 ring-red-500/10" : "border-slate-100 focus:border-blue-200 focus:ring-4 focus:ring-blue-500/10"
        }`}
      />

      <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-label={listening ? "Stop listening" : "Speak a task"}
          aria-pressed={listening}
          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
            listening ? "bg-red-500 text-white animate-pulse" : "bg-slate-100 hover:bg-slate-200 text-slate-600"
          }`}
        >
          {listening ? <MicOff size={18} strokeWidth={2.5} /> : <Mic size={18} strokeWidth={2.5} />}
        </button>

        <button
          type="submit"
          disabled={busy || listening || !text.trim()}
          aria-label="Add task"
          className="w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-2xl flex items-center justify-center transition-colors duration-200 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          {busy ? <Loader2 className="animate-spin" size={18} strokeWidth={3} /> : <ArrowUp size={20} strokeWidth={3} />}
        </button>
      </div>
    </form>
  );
}
