import { formatDueIst, istDateKey } from "./date";

/** Alert choices (minutes before the due time). `null` on a reminder means the default: 1 hour, 10 min, 1 min. */
export const ALERT_CHOICES = [
  { minutes: 1440, label: "1 day" },
  { minutes: 180, label: "3 hours" },
  { minutes: 60, label: "1 hour" },
  { minutes: 10, label: "10 min" },
  { minutes: 1, label: "1 min" },
];
export const MAX_STEPS = 20;

export const newStepId = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Checklist as the server wants it: trimmed, no empty steps, at most 20. */
export function cleanSteps(steps) {
  return (steps || [])
    .map((s) => ({ id: s.id || newStepId(), text: String(s.text || "").trim().slice(0, 120), done: !!s.done }))
    .filter((s) => s.text)
    .slice(0, MAX_STEPS);
}

export const cleanAlerts = (alerts) => (Array.isArray(alerts) ? [...alerts].sort((a, b) => b - a) : null);

/** Categories in use, biggest first: [{ name, count }]. */
export function categoryCounts(tasks) {
  const map = new Map();
  for (const t of tasks) {
    if (t.deleted || !t.category) continue;
    map.set(t.category, (map.get(t.category) || 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
}

/** Groups tasks by category: [{ key, label, tasks }], biggest group first. */
export function groupByCategory(tasks) {
  const map = new Map();
  for (const t of tasks) {
    const k = t.category || "No category";
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(t);
  }
  return [...map.entries()].sort((a, b) => b[1].length - a[1].length).map(([label, list]) => ({ key: `cat-${label}`, label, tasks: list }));
}

/** Cells of a month grid starting on Monday: null for blanks, else the day number. month is 0-11. */
export function monthGrid(year, month) {
  const lead = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells = Array(lead).fill(null);
  for (let d = 1; d <= days; d += 1) cells.push(d);
  while (cells.length % 7) cells.push(null);
  return cells;
}

/** Pending reminders per IST day: { "2026-11-20": 3 }. */
export function dayCounts(tasks) {
  const out = {};
  for (const t of tasks) {
    if (t.deleted || t.status === "completed" || !t.due_date) continue;
    const k = istDateKey(Date.parse(t.due_date));
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

/** Plain-text copy of the reminders, for a backup. */
export function exportText(tasks) {
  const rows = tasks.filter((t) => !t.deleted).sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")));
  const line = (t) => {
    const bits = [t.status === "completed" ? "[x]" : "[ ]", t.title, "|", t.due_date ? `${formatDueIst(t.due_date)} IST` : "No date"];
    if (t.category) bits.push("|", t.category);
    if (t.schedule_type && t.schedule_type !== "once" && t.schedule_label) bits.push("|", t.schedule_label);
    if (t.priority === "high") bits.push("|", "HIGH");
    if (t.description) bits.push("|", String(t.description).replace(/\s+/g, " "));
    const steps = (t.subtasks || []).map((s) => `\n    ${s.done ? "[x]" : "[ ]"} ${s.text}`).join("");
    return bits.join(" ") + steps;
  };
  return `GetRemindMe reminders (${rows.length})\n\n${rows.map(line).join("\n")}\n`;
}

export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
