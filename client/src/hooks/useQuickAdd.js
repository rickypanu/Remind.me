import { useCallback } from "react";
import { createTask } from "../offline/taskStore";
import { parseQuick } from "../utils/quickParse";
import { pingServer } from "../utils/warmup";

/**
 * Quick add, built to feel instant:
 *
 *   1. The sentence is read ON THE DEVICE (utils/quickParse.js, a few milliseconds, no network).
 *   2. The reminder is written to the device database and shows in the list right away.
 *   3. The sync engine uploads it in the background (and a cold, sleeping server is woken at the same moment).
 *   No AI is involved anywhere: the sentence is read by plain rules, so nothing can be slow, busy or out of quota.
 *
 * `add(text)` resolves with `{ task, parsed }` as soon as step 2 is done.
 */
export default function useQuickAdd() {
  const add = useCallback(async (text) => {
    const parsed = parseQuick(text);
    if (!parsed) return null;
    const task = await createTask(parsed.payload, { silent: true, learn: false });
    pingServer({ force: true });
    return { task, parsed };
  }, []);

  return { add };
}
