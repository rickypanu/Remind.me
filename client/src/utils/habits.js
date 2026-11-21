// The "usual times" learned by quick add (see timeHabits.js), kept in this browser only. Never sent to the server.
const KEY = "rm_time_habits_v1";

export function loadHabits() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {}; // private mode or blocked storage: no habits, quick add still works
  }
}

export function saveHabits(habits) {
  try {
    localStorage.setItem(KEY, JSON.stringify(habits));
  } catch {
    /* kept until the tab closes */
  }
}
