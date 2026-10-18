import React, { useRef, useState } from "react";
import { Volume2, Vibrate, Play, Upload, Trash2, Check, Music } from "lucide-react";
import { Row } from "../pages/components/AppearanceSettings";
import { useFeedbackSettings, updateSettings } from "../feedback/settings";
import { hapticsSupported, vibrate } from "../feedback/haptics";
import { feedback } from "../feedback/feedback";
import {
  ALERT_OPTIONS, playAlert, saveCustomSound, removeCustomSound, stopAlert, MAX_CUSTOM_BYTES,
} from "../feedback/sounds";
import notify from "../utils/notify";

/** "Sound & haptics" card for the Profile page. Preferences are saved on this device. */
export default function FeedbackSettings() {
  const s = useFeedbackSettings();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const canVibrate = hapticsSupported();

  const toggleSound = () => {
    const next = !s.soundEffects;
    updateSettings({ soundEffects: next });
    if (next) setTimeout(() => feedback.added(), 0); // let the user hear what they just enabled
  };
  const toggleHaptics = () => {
    const next = !s.haptics;
    updateSettings({ haptics: next });
    if (next) setTimeout(() => vibrate([14]), 0);
  };

  const choose = (id) => {
    stopAlert();
    updateSettings({ alertSound: id });
    playAlert(id);
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    const result = await saveCustomSound(file);
    setBusy(false);
    if (result.ok) {
      notify.success("Custom sound saved.");
      playAlert("custom");
    } else notify.error(result.error);
  };

  const options = [
    ...ALERT_OPTIONS,
    ...(s.customSoundName ? [{ id: "custom", label: s.customSoundName, hint: "Your own sound", custom: true }] : []),
  ];

  return (
    <div>
      <h3 className="px-3 text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">Sound &amp; haptics</h3>
      <div className="bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)]">
        <Row
          icon={Volume2}
          label="Enable Sound Effects"
          subLabel="Soft sounds when you add, update or complete a reminder"
          checked={s.soundEffects}
          onChange={toggleSound}
        />
        <Row
          icon={Vibrate}
          label="Enable Haptic Vibration"
          subLabel={canVibrate ? "A light buzz on the same actions and on alerts" : "Not supported by this browser (iPhone and iPad don't allow it)"}
          checked={s.haptics && canVibrate}
          onChange={canVibrate ? toggleHaptics : () => {}}
        />

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600"><Music size={20} /></div>
            <div className="text-left">
              <p className="font-medium text-gray-900">Notification sound</p>
              <p className="text-xs text-gray-500 mt-0.5">Plays when an alert arrives while RemindMe is open</p>
            </div>
          </div>

          <ul role="radiogroup" aria-label="Notification sound" className="mt-3 space-y-1">
            {options.map((o) => {
              const active = s.alertSound === o.id;
              return (
                <li key={o.id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${active ? "border-blue-200 bg-blue-50" : "border-transparent hover:bg-gray-50"}`}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => choose(o.id)}
                    className="flex min-h-[40px] flex-1 items-center gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
                  >
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${active ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300"}`}>
                      {active && <Check size={12} strokeWidth={3} />}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-gray-900">{o.label}</span>
                      <span className="block truncate text-xs text-gray-500">{o.hint}</span>
                    </span>
                  </button>
                  {o.id !== "system" && (
                    <button type="button" aria-label={`Preview ${o.label}`} onClick={() => playAlert(o.id)} className="rounded-full p-2 text-gray-500 hover:bg-white hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                      <Play size={16} strokeWidth={2.5} />
                    </button>
                  )}
                  {o.custom && (
                    <button type="button" aria-label="Remove custom sound" onClick={removeCustomSound} className="rounded-full p-2 text-gray-400 hover:bg-white hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400">
                      <Trash2 size={16} strokeWidth={2.25} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>

          <input ref={fileRef} type="file" accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav" onChange={onFile} className="hidden" />
          <button
            type="button"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
            className="mt-3 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 text-sm font-semibold text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Upload size={16} strokeWidth={2.5} /> {s.customSoundName ? "Replace custom sound" : "Upload your own (.mp3 / .wav)"}
          </button>
          <p className="mt-2 px-1 text-[11px] leading-relaxed text-gray-400">
            Up to {Math.round(MAX_CUSTOM_BYTES / 1024 / 1024)} MB and 30 seconds. When the app is closed, your device plays its own notification sound; browsers don't allow custom sounds for background notifications.
          </p>
        </div>
      </div>
    </div>
  );
}
