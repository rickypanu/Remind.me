import { CLASSIC_QUOTES, RELATABLE_LINES } from "../../data/quotes.data";

/**
 * The dashboard's motivation card, as pure functions (no React, no clock, no storage), so every rule is testable.
 *
 *   buildMotivation({ name, userId, dayKey, hour, streak, bestStreak, doneToday, pendingToday, overdue }, shuffle)
 *     -> { situation, headline, quote: { text, author, role, kind } }
 *
 * The HEADLINE speaks to what the user is doing right now (name, streak, what is done / left). The QUOTE is a line
 * from an athlete, leader or thinker, or a plain line written for the app, chosen to fit the same moment. Both are
 * picked deterministically from (user, day), so the card does not change on every render; `shuffle` asks for
 * another quote.
 */

const THEMES_BY_SITUATION = {
  allDone: ["rest", "joy"],
  streak: ["consistency", "persist"],
  streakAtRisk: ["start", "focus", "consistency"],
  overdue: ["comeback", "start"],
  progress: ["persist", "focus"],
  restart: ["comeback", "start"],
  empty: ["start", "rest"],
  morning: ["start", "focus"],
  afternoon: ["persist", "focus"],
  evening: ["rest", "consistency"],
  night: ["rest"],
};

const HEADLINES = {
  allDone: [
    "All clear for today, {name}. {done} done. You earned a breather.",
    "Everything on today's list is finished, {name}. That's a good day's work.",
  ],
  streakLong: [
    "{streak} days in a row, {name}. That's not luck, that's who you're becoming.",
    "{streak}-day streak, {name}! You're building something real.",
  ],
  streakShort: [
    "Day {streak} of your streak, {name}. Keep the chain going.",
    "{streak} days straight, {name}. Nice rhythm.",
  ],
  streakAtRisk: [
    "Your {streak}-day streak is waiting on you, {name}. One tick keeps it alive.",
    "Finish one thing today, {name}, and your {streak}-day streak lives on.",
  ],
  overdue: [
    "A few things slipped, {name}. That's okay: pick the smallest one and start there.",
    "Some reminders are behind, {name}. One at a time, starting with the easiest.",
  ],
  progress: [
    "{done} down today, {name}. {pending} to go.",
    "{done} done, {pending} left, {name}. Keep the momentum.",
  ],
  restart: [
    "Your best run was {best} days, {name}. Today is a good day to beat it.",
    "A fresh start, {name}. Your best streak is {best} days; let's go past it.",
  ],
  empty: [
    "A free day, {name}. Plan one thing you'd be proud of tonight.",
    "Nothing due today, {name}. A good moment to get ahead.",
  ],
  fallback: [
    "You've got this, {name}.",
    "One thing at a time, {name}.",
  ],
};

/** 32-bit FNV-1a: a tiny stable hash, so the same (user, day) always picks the same line. */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

const pick = (list, seed) => list[hashString(seed) % list.length];
const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));

export function timeOfDay(hour) {
  if (hour >= 22 || hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

/** Which of the user's situations to speak to. The first rule that matches wins. */
export function pickSituation({ streak, bestStreak, doneToday, pendingToday, overdue, hour }) {
  const hasStreak = Number.isFinite(streak);
  if (doneToday > 0 && pendingToday === 0) return "allDone";
  if (hasStreak && streak >= 2 && doneToday > 0) return "streak";
  if (hasStreak && streak >= 1 && doneToday === 0) return "streakAtRisk";
  if (overdue > 0) return "overdue";
  if (doneToday > 0) return "progress";
  if (hasStreak && streak === 0 && bestStreak >= 3) return "restart";
  if (pendingToday === 0) return "empty";
  return timeOfDay(hour);
}

function headlineFor(situation, ctx, seed) {
  const group =
    situation === "streak" ? (ctx.streak >= 7 ? "streakLong" : "streakShort") : HEADLINES[situation] ? situation : "fallback";
  const name = (ctx.name || "").trim().split(/\s+/)[0];
  let template = pick(HEADLINES[group], `${seed}|h|${group}`);
  if (!name) template = template.replace(/,\s*\{name\}/g, ""); // no name known: "Keep going, {name}." -> "Keep going."
  return fill(template, {
    name,
    streak: ctx.streak,
    best: ctx.bestStreak,
    done: ctx.doneToday,
    pending: ctx.pendingToday,
  });
}

function quoteFor(situation, seed, shuffle) {
  const themes = THEMES_BY_SITUATION[situation] || THEMES_BY_SITUATION.morning;
  const fits = (item) => item.themes.some((theme) => themes.includes(theme));
  const classic = CLASSIC_QUOTES.filter(fits).map((q) => ({ ...q, kind: "classic" }));
  const relatable = RELATABLE_LINES.filter(fits).map((q) => ({ ...q, author: "", role: "", kind: "relatable" }));

  // Alternate between the two pools so the card is not only famous names or only app-written lines.
  const turn = hashString(`${seed}|kind`) + shuffle;
  const pool = turn % 2 === 0 && classic.length ? classic : relatable.length ? relatable : classic;
  const item = pool[hashString(`${seed}|q|${shuffle}`) % pool.length];
  return { text: item.text, author: item.author, role: item.role, kind: item.kind };
}

export function buildMotivation(input, shuffle = 0) {
  const ctx = {
    name: input.name || "",
    userId: input.userId || "anon",
    dayKey: input.dayKey || "",
    hour: Number.isFinite(input.hour) ? input.hour : 12,
    streak: Number.isFinite(input.streak) ? input.streak : null,
    bestStreak: Number.isFinite(input.bestStreak) ? input.bestStreak : 0,
    doneToday: input.doneToday || 0,
    pendingToday: input.pendingToday || 0,
    overdue: input.overdue || 0,
  };
  const situation = pickSituation(ctx);
  const seed = `${ctx.userId}|${ctx.dayKey}|${situation}`;
  return { situation, headline: headlineFor(situation, ctx, seed), quote: quoteFor(situation, seed, shuffle) };
}

/**
 * The streak to show. The server only knows about completions it has received; one made a moment ago on this device
 * (or offline) may not have been uploaded yet. If the server has nothing for today but the screen shows something
 * done today, the streak is one longer than the server says.
 */
export function effectiveStreak(stats, doneTodayLocally) {
  if (!stats || !Number.isFinite(stats.streak)) return null;
  const bump = stats.completed_today === 0 && doneTodayLocally > 0 ? 1 : 0;
  return stats.streak + bump;
}
