import { useCallback, useRef, useState } from "react";
import { createTask } from "../offline/taskStore";
import { parseQuick } from "../utils/quickParse";
import { learnHabit } from "../utils/timeHabits";
import { loadHabits, saveHabits } from "../utils/habits";
import { pingServer } from "../utils/warmup";

/**
 * Quick add, built to feel instant:
 *
 *   1. The sentence is read ON THE DEVICE (utils/quickParse.js, a few milliseconds, no network).
 *   2. The reminder is written to the device database and shows in the list right away.
 *   3. The sync engine uploads it in the background (and a cold, sleeping server is woken at the same moment).
 *   No AI is involved anywhere: the sentence is read by plain rules, so nothing can be slow, busy or out of quota.
 *
 * `habits` are the times this person usually picks ("gym" at 6 am): a time they said teaches the next default,
 * and they stay in this browser only.
 *
 * `add(text)` resolves with `{ task, parsed }` as soon as step 2 is done.
 */
export default function useQuickAdd() {
  const [habits, setHabits] = useState(loadHabits);
  const habitsRef = useRef(habits);
  habitsRef.current = habits;

  const add = useCallback(async (text) => {
    const parsed = parseQuick(text, Date.now(), habitsRef.current);
    if (!parsed) return null;
    const task = await createTask(parsed.payload, { silent: true, learn: false });
    pingServer({ force: true });
    const learned = learnHabit(habitsRef.current, parsed);
    if (learned !== habitsRef.current) {
      saveHabits(learned);
      setHabits(learned);
    }
    return { task, parsed };
  }, []);

  return { add, habits };
}
