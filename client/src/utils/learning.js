// Remembers, on this device only, which category the person files their reminders under (see categoryModel.js).
import { emptyPersonal, getPersonal, learnCategory, setPersonal } from "./categoryModel";

const KEY = "rm-learn-v1";

try {
  const saved = JSON.parse(localStorage.getItem(KEY) || "null");
  if (saved) setPersonal(saved);
} catch {
  /* blocked storage or an old format: start empty */
}

/** The person filed `title` under `category` (a form choice, or a fix after quick add). */
export function rememberCategory(title, category) {
  if (!title || !category) return;
  const next = learnCategory(getPersonal(), title, category);
  setPersonal(next);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* the memory just lasts until the tab closes */
  }
}

export function forgetLearning() {
  setPersonal(emptyPersonal());
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
