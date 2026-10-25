import React from "react";
import { Link } from "react-router-dom";
import { Bell, BellRing, BellOff, Loader2, Send, ChevronRight, Play, ShieldAlert, Smartphone } from "lucide-react";
import AppPage from "../../components/AppPage";
import FeedbackSettings from "../../components/FeedbackSettings";
import usePush from "../../utils/usePush";
import usePageMeta from "../../utils/usePageMeta";
import { feedback } from "../../feedback/feedback";

const card = "bg-white border border-gray-100 rounded-[24px] overflow-hidden shadow-[0_4px_20px_rgb(0,0,0,0.03)]";
const heading = "px-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2";

/** One place for everything about being notified: browser alerts, Telegram, sound and vibration. */
export default function Notifications() {
  usePageMeta({
    title: "Notifications",
    description: "Choose how RemindMe alerts you: browser notifications, Telegram, sound and vibration.",
    noindex: true,
  });
  const { pushStatus, toggle, permission, supported } = usePush(true);

  const on = pushStatus === "subscribed";
  const loading = pushStatus === "loading";
  const blocked = permission === "denied";

  let status = { label: "Off on this device", tone: "bg-gray-100 text-gray-600" };
  if (on) status = { label: "On for this device", tone: "bg-emerald-50 text-emerald-700" };
  if (!supported) status = { label: "Not available", tone: "bg-amber-50 text-amber-700" };
  else if (blocked && !on) status = { label: "Blocked by browser", tone: "bg-rose-50 text-rose-700" };

  return (
    <AppPage title="Notifications" subtitle="Choose how RemindMe gets your attention." backTo="/profile" backLabel="Profile" width="narrow">
      <div className="space-y-8">
        {/* 1. Browser alerts */}
        <section aria-labelledby="web-alerts">
          <h2 id="web-alerts" className={heading}>Browser alerts</h2>
          <div className={`${card} p-5 sm:p-6`}>
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-2xl bg-indigo-50 text-indigo-600 shrink-0">
                {on ? <BellRing size={22} /> : <Bell size={22} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-gray-900">Web notifications</h3>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${status.tone}`}>{status.label}</span>
                </div>
                <p className="mt-1 text-sm leading-relaxed text-gray-500">
                  Get a pop-up on this device when a reminder is due, even when RemindMe isn't open. This is set per
                  device, so turn it on for each phone or computer you use.
                </p>
              </div>
            </div>

            {!supported && (
              <p className="mt-4 flex gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <Smartphone size={18} className="mt-0.5 shrink-0" />
                <span>This browser can't receive push alerts. On iPhone or iPad, add RemindMe to your Home Screen first, then open it from there.</span>
              </p>
            )}
            {supported && blocked && !on && (
              <p className="mt-4 flex gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <ShieldAlert size={18} className="mt-0.5 shrink-0" />
                <span>Notifications are blocked for this site. Allow them from the lock icon next to the address bar (or your browser's site settings), then come back and turn alerts on.</span>
              </p>
            )}

            <button
              type="button"
              onClick={toggle}
              disabled={loading || !supported || (blocked && !on)}
              className={`mt-5 flex w-full min-h-[48px] items-center justify-center gap-2 rounded-2xl text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                on ? "bg-gray-100 text-gray-800 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : on ? <BellOff size={18} /> : <BellRing size={18} />}
              {loading ? "Updating…" : on ? "Turn off alerts on this device" : "Turn on alerts on this device"}
            </button>
          </div>
        </section>

        {/* 2. Telegram */}
        <section aria-labelledby="telegram">
          <h2 id="telegram" className={heading}>Telegram</h2>
          <div className={card}>
            <Link to="/telegram-setup" className="flex items-center justify-between gap-4 p-5 sm:p-6 bg-white hover:bg-gray-50 active:bg-gray-100 transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className="p-3 rounded-2xl bg-sky-50 text-sky-600 shrink-0"><Send size={22} /></div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">Telegram alerts</p>
                  <p className="mt-0.5 text-sm text-gray-500">Connect or manage the bot that messages you reminders.</p>
                </div>
              </div>
              <ChevronRight size={18} className="text-gray-500 shrink-0" />
            </Link>
          </div>
        </section>

        {/* 3. Sound & vibration */}
        <section aria-label="Sound and vibration">
          <FeedbackSettings />
          <button
            type="button"
            onClick={() => feedback.notification()}
            className="mt-3 flex w-full min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Play size={16} strokeWidth={2.5} /> Preview an alert (sound and vibration)
          </button>
        </section>
      </div>
    </AppPage>
  );
}
