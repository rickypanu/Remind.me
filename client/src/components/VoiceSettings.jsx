import React from "react";
import useMe from "../hooks/useMe";
import { useSetVoice } from "../hooks/useProfileMutations";
import notify from "../utils/notify";

// A sample of each tone: the first "time is up" line from the phone app's line bank (same words the server sends).
const TONES = [
  { id: "friendly", label: "Friendly", en: "It's time. You've got this.", hinglish: "Time ho gaya! Chal, ho jayega." },
  { id: "funny", label: "Funny", en: "Plot twist: it's actually time now.", hinglish: "Plot twist: time sach mein ho gaya." },
  { id: "strict", label: "Strict coach", en: "Time's up. Start now.", hinglish: "Time ho gaya. Abhi shuru kar." },
  { id: "calm", label: "Calm", en: "It's time, whenever you're ready.", hinglish: "Time ho gaya, jab tu ready ho." },
];

/** "How notifications talk": the tone and language of Telegram and browser reminders (the phone app uses the same choice). */
export default function VoiceSettings() {
  const { data: me } = useMe();
  const setVoice = useSetVoice();
  const tone = me?.notify_tone || "friendly";
  const lang = me?.notify_lang || "en";

  const choose = (next) => {
    setVoice.mutate(
      { tone, lang, ...next },
      { onError: () => notify.error("Could not save that. Check your connection and try again.") },
    );
  };

  return (
    <div>
      <h3 className="px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">How notifications talk</h3>
      <div className="bg-white border-[1.5px] border-slate-900 rounded-[24px] overflow-hidden shadow-[4px_4px_0_0_#14161f]">
        <div role="radiogroup" aria-label="Notification tone">
          {TONES.map((t) => {
            const on = tone === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => choose({ tone: t.id })}
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 p-4 text-left last:border-0 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <span>
                  <span className="block font-medium text-gray-900">{t.label}</span>
                  <span data-no-translate className="mt-0.5 block text-sm text-gray-500">“{t[lang]}”</span>
                </span>
                <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${on ? "border-slate-900 bg-slate-900 shadow-[inset_0_0_0_3px_#fff]" : "border-slate-300"}`} />
              </button>
            );
          })}
        </div>
        <div className="flex gap-2 border-t border-gray-100 p-4">
          {[["en", "English"], ["hinglish", "Hinglish"]].map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={lang === id}
              onClick={() => choose({ lang: id })}
              className={`rounded-xl border-[1.5px] px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${
                lang === id ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-gray-700 hover:border-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
