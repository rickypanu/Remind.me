import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarDays, Clock, AlertCircle } from "./icons";
import useNotificationFeed from "../hooks/useNotificationFeed";
import { useI18n } from "../i18n";

const ICON = { week: CalendarDays, soon: Clock, missed: AlertCircle };
const TONE = { week: "bg-blue-50 text-blue-600", soon: "bg-amber-50 text-amber-600", missed: "bg-rose-50 text-rose-600" };

function bodyOf(x, t) {
  if (x.kind === "week") {
    const line = t("{n} due this coming week", { n: x.week });
    return x.overdue ? `${line}, ${t("{n} overdue", { n: x.overdue })}.` : `${line}.`;
  }
  if (x.kind === "soon") return t("Due in {n} min", { n: x.mins });
  return t("You missed this one");
}

function ago(at, now, t) {
  const diff = now - at;
  if (diff < 0) return t("Soon");
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("Just now");
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** Bell with an unread badge and a dropdown feed, like the activity tab of a social app. */
export default function NotificationBell({ className = "" }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { items, unread, markAllSeen } = useNotificationFeed(true);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open) setTimeout(markAllSeen, 1200); // the badge clears once the person has had a moment to look
  };

  return (
    <div ref={box} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `${t("Notifications")} (${unread})` : t("Notifications")}
        aria-expanded={open}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 active:scale-95"
      >
        <Bell size={18} strokeWidth={2.5} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white" data-no-translate>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label={t("Notifications")} className="absolute right-0 top-12 z-[60] w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/15 ring-1 ring-slate-200">
          <div className="px-4 pb-2 pt-3.5 text-[15px] font-extrabold text-slate-900">{t("Notifications")}</div>
          {items.length === 0 ? (
            <p className="px-4 pb-6 pt-2 text-sm text-slate-500">{t("You are all caught up.")}</p>
          ) : (
            <ul className="max-h-[420px] overflow-y-auto pb-2">
              {items.map((x) => {
                const Icon = ICON[x.kind];
                return (
                  <li key={x.id}>
                    <button
                      type="button"
                      onClick={() => { setOpen(false); navigate("/u"); }}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:bg-slate-50"
                    >
                      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${TONE[x.kind]}`}><Icon size={17} strokeWidth={2.4} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-bold text-slate-900" {...(x.kind === "week" ? {} : { "data-no-translate": true })}>{x.kind === "week" ? t(x.title) : x.title}</span>
                        <span className="block text-[13px] text-slate-500">{bodyOf(x, t)}</span>
                      </span>
                      <span className="shrink-0 pt-0.5 text-[12px] font-medium text-slate-400" data-no-translate>{ago(x.at, Date.now(), t)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
