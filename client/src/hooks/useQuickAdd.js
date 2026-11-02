import { useCallback } from "react";
import { tasksApi } from "../api";
import { getAllTasks } from "../offline/db";
import { createTask, editTask } from "../offline/taskStore";
import { parseQuick } from "../utils/quickParse";
import { pingServer } from "../utils/warmup";

/**
 * Quick add, built to feel instant:
 *
 *   1. The sentence is read ON THE PHONE (utils/quickParse.js, a few milliseconds, no network, no AI quota).
 *   2. The reminder is written to the device database and shows in the list right away.
 *   3. The sync engine uploads it in the background (and a cold, sleeping server is woken at the same moment).
 *   4. Only when the phone was unsure about a longer sentence, the server's AI is asked, in the background, to
 *      polish the title / time. A slow, busy or missing AI therefore never delays or blocks anything.
 *
 * `add(text)` resolves with `{ task, parsed }` as soon as step 2 is done.
 */
export default function useQuickAdd() {
  const add = useCallback(async (text) => {
    const parsed = parseQuick(text);
    if (!parsed) return null;
    const task = await createTask(parsed.payload, { silent: true });
    pingServer({ force: true });
    if (parsed.confidence === "low" && navigator.onLine) polishInBackground(task, text.trim());
    return { task, parsed };
  }, []);

  return { add };
}

/** Ask the AI for a better reading of a sentence the phone could not place. Never throws; silently gives up. */
async function polishInBackground(task, text) {
  try {
    const ai = await tasksApi.magicParse(text);
    if (!ai || ai.schedule_type !== "once" || !ai.title) return; // a repeat can't be switched on an existing reminder
    // Only touch it if the person has not edited it in the meantime
    const current = (await getAllTasks()).find((t) => t.clientId === task.clientId && !t.deleted);
    if (!current || current.title !== task.title || current.status !== "pending") return;
    await editTask(current.id, { title: ai.title, category: ai.category || current.category, due_date: ai.due_date || current.due_date }, { silent: true });
  } catch {
    /* offline, busy or refused: the reminder the phone already saved stays exactly as it is */
  }
}
