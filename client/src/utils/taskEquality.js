/**
 * Is this the same reminder, as far as what a card shows? The offline store hands out fresh copies of every task
 * whenever anything changes, so comparing by identity would re-render every card on every change. These are the
 * fields a card displays or acts on; `rev` changes on every local edit.
 */
const FIELDS = [
  "id", "rev", "status", "title", "description", "category", "due_date", "needsSync",
  "updated_at", "schedule_type", "schedule_label", "priority",
];

export function sameTask(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  return FIELDS.every((field) => a[field] === b[field]);
}
