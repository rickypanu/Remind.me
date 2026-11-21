/** Invite links: https://<site>/join/<CODE>. The code waits in storage while a new person signs up or logs in. */
const KEY = "rm_pending_invite";

export const inviteLink = (code) => `${window.location.origin}/join/${code}`;

export function savePendingInvite(code) {
  try {
    localStorage.setItem(KEY, String(code).toUpperCase().slice(0, 16));
  } catch {
    /* storage blocked: the person can still type the code by hand */
  }
}

/** The waiting code (if any), removed so it is used once. */
export function takePendingInvite() {
  try {
    const code = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return code;
  } catch {
    return null;
  }
}

/** Share through the phone's share sheet when there is one, otherwise copy the link. Returns "shared" | "copied" | "failed". */
export async function shareInvite(code, name) {
  const url = inviteLink(code);
  const text = `${name ? `${name} invited you` : "Join me"} on GetRemindMe. Reminders that actually ring. Use my code ${code}:`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "GetRemindMe", text, url });
      return "shared";
    }
    await navigator.clipboard.writeText(`${text} ${url}`);
    return "copied";
  } catch (error) {
    if (error?.name === "AbortError") return "failed";
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      return "copied";
    } catch {
      return "failed";
    }
  }
}
