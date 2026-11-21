import React, { useEffect, useRef, useState } from "react";
import { Check, Flame, Heart, Send, Share, UserPlus, X, Loader2, Trash2, Gift } from "../icons";
import Modal from "../Modal";
import notify from "../../utils/notify";
import { resolveAvatarSrc } from "../../utils/avatar";
import { shareInvite } from "../../utils/invite";
import { useJoinFriend, useRemindFriend, useSetBuddy, useSocial, useUnfriend } from "../../hooks/useSocial";

const card = "rounded-[24px] border-[1.5px] border-slate-900 bg-white shadow-[4px_4px_0_0_#14161f]";
const field =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20";

function Avatar({ friend, size = 44 }) {
  const src = friend.avatar_url ? resolveAvatarSrc(friend.avatar_url) : null;
  return src ? (
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full bg-blue-50 object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-extrabold text-blue-700" style={{ width: size, height: size }}>
      {(friend.username || "?").slice(0, 1).toUpperCase()}
    </span>
  );
}

/** A local date-time for the input's default: one hour from now, to the minute. */
const defaultWhen = () => {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

function SendReminderModal({ friend, onClose }) {
  const send = useRemindFriend();
  const titleRef = useRef(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [when, setWhen] = useState(defaultWhen);

  const submit = async (event) => {
    event.preventDefault();
    if (!title.trim()) return;
    try {
      await send.mutateAsync({ id: friend.id, title: title.trim(), note: note.trim() || null, due_date: new Date(when).toISOString() });
      notify.success(`Reminder sent to ${friend.username}.`);
      onClose();
    } catch (error) {
      notify.error(error, "Could not send that reminder.");
    }
  };

  return (
    <Modal onClose={onClose} labelledBy="send-reminder-title" busy={send.isPending} align="sheet" initialFocusRef={titleRef}>
      <form onSubmit={submit} className="w-full max-w-md rounded-t-[28px] bg-white p-6 shadow-xl sm:rounded-[28px]">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="send-reminder-title" className="text-lg font-extrabold text-slate-900">
            Remind {friend.username}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>
        <label className="mb-3 block text-xs font-bold text-slate-600">
          What should they remember?
          <input ref={titleRef} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder="Bring the project notes" className={`${field} mt-1`} required />
        </label>
        <label className="mb-3 block text-xs font-bold text-slate-600">
          When
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${field} mt-1`} required />
        </label>
        <label className="mb-5 block text-xs font-bold text-slate-600">
          Note (optional)
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Library, 2nd floor" className={`${field} mt-1`} />
        </label>
        <button type="submit" disabled={send.isPending || !title.trim()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-[15px] font-bold text-white hover:bg-blue-700 disabled:opacity-50">
          {send.isPending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          Send reminder
        </button>
      </form>
    </Modal>
  );
}

/** Invite code, join with a code, the friend list with streaks, sending a reminder and choosing a buddy. */
export default function FriendsCard({ myName }) {
  const social = useSocial();
  const join = useJoinFriend();
  const unfriend = useUnfriend();
  const setBuddy = useSetBuddy();
  const [code, setCode] = useState("");
  const [target, setTarget] = useState(null);
  const data = social.data;

  useEffect(() => {
    if (social.isError && social.error?.response?.status !== 401) {
      /* The card shows its own message below; no toast, so an offline profile page stays quiet. */
    }
  }, [social.isError, social.error]);

  const onShare = async () => {
    const result = await shareInvite(data.invite_code, myName);
    if (result === "copied") notify.success("Invite copied. Paste it to a friend.");
    if (result === "failed") notify.error("Could not share. Copy the code instead.");
  };
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.invite_code);
      notify.success("Code copied.");
    } catch {
      notify.error("Could not copy. Select the code and copy it.");
    }
  };
  const onJoin = async (event) => {
    event.preventDefault();
    if (!code.trim()) return;
    try {
      const res = await join.mutateAsync(code);
      notify.success(res.message);
      setCode("");
    } catch (error) {
      notify.error(error, "Could not use that code.");
    }
  };
  const toggleBuddy = async (friend) => {
    try {
      await setBuddy.mutateAsync(friend.is_buddy ? null : friend.id);
      notify.success(friend.is_buddy ? "Buddy removed." : `${friend.username} is your buddy. They get a nudge when you finish something.`);
    } catch (error) {
      notify.error(error, "Could not change your buddy.");
    }
  };
  const remove = async (friend) => {
    if (!window.confirm(`Remove ${friend.username} from your friends?`)) return;
    try {
      await unfriend.mutateAsync(friend.id);
    } catch (error) {
      notify.error(error, "Could not remove that friend.");
    }
  };

  return (
    <div>
      <h3 className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Friends</h3>
      <div className={`${card} p-5`}>
        {social.isPending && <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />}
        {social.isError && <p className="text-sm font-medium text-slate-600">Friends are unavailable right now. Check your connection and reopen this page.</p>}
        {data && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Your invite code</p>
                <button type="button" onClick={onCopy} aria-label={`Copy invite code ${data.invite_code}`} className="mt-1 rounded-xl bg-[color:var(--rm-soft)] px-4 py-2 font-mono text-2xl font-extrabold tracking-[0.2em] text-slate-900 hover:bg-[color:var(--rm-soft-2)]">
                  {data.invite_code}
                </button>
              </div>
              <button type="button" onClick={onShare} className="flex items-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
                <Share size={17} /> Invite a friend
              </button>
            </div>

            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-amber-50 p-3.5">
              <Gift size={20} className="shrink-0 text-amber-700" />
              <p className="flex-1 text-[13px] font-semibold text-amber-900">
                {data.reward_unlocked
                  ? "Connector badge unlocked. Thanks for spreading the word."
                  : `${data.invited_count} of ${data.reward_target} friends joined. Reach ${data.reward_target} to unlock the Connector badge.`}
              </p>
              <span className="flex gap-1" aria-hidden="true">
                {Array.from({ length: data.reward_target }, (_, i) => (
                  <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < data.invited_count ? "bg-amber-500" : "bg-amber-200"}`} />
                ))}
              </span>
            </div>

            <form onSubmit={onJoin} className="mt-4 flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={16} placeholder="Got a friend's code? Enter it" aria-label="Friend's invite code" autoCapitalize="characters" autoComplete="off" className={`${field} font-mono tracking-widest`} />
              <button type="submit" disabled={join.isPending || !code.trim()} className="flex shrink-0 items-center gap-2 rounded-xl border-[1.5px] border-slate-900 bg-white px-4 text-sm font-bold text-slate-900 hover:bg-slate-50 disabled:opacity-50">
                {join.isPending ? <Loader2 size={16} className="animate-spin" /> : <UserPlus size={16} />} Add
              </button>
            </form>

            <ul className="mt-5 divide-y divide-slate-100">
              {data.friends.length === 0 && <li className="py-3 text-sm font-medium text-slate-500">No friends yet. Share your code and your friends show up here with their streaks.</li>}
              {data.friends.map((f) => (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar friend={f} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-slate-900">
                      {f.username} {f.is_buddy && <span className="ml-1 rounded-md bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-blue-700">Buddy</span>}
                    </p>
                    <p className="flex items-center gap-1 text-xs font-semibold text-slate-500">
                      <Flame size={13} className="text-amber-500" /> {f.streak} day streak
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button type="button" onClick={() => setTarget(f)} aria-label={`Send a reminder to ${f.username}`} title="Send a reminder" className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100"><Send size={17} /></button>
                    <button type="button" onClick={() => toggleBuddy(f)} aria-pressed={f.is_buddy} aria-label={f.is_buddy ? `Remove ${f.username} as buddy` : `Make ${f.username} your buddy`} title={f.is_buddy ? "Remove buddy" : "Make buddy"} className={`rounded-xl p-2.5 ${f.is_buddy ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>{f.is_buddy ? <Check size={17} /> : <Heart size={17} />}</button>
                    <button type="button" onClick={() => remove(f)} aria-label={`Remove ${f.username}`} title="Remove friend" className="rounded-xl p-2.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={17} /></button>
                  </div>
                </li>
              ))}
            </ul>
            {data.friends.length > 0 && <p className="mt-3 text-xs font-medium text-slate-500">A buddy gets one nudge a day, when you finish your first reminder.</p>}
          </>
        )}
      </div>
      {target && <SendReminderModal friend={target} onClose={() => setTarget(null)} />}
    </div>
  );
}
