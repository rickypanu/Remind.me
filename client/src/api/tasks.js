import api from "../utils/api";

const TIMEOUT = { timeout: 20000 };

/**
 * Reminder endpoints. The app reads and writes reminders through the offline store (src/offline); only the
 * sync engine calls the CRUD functions below. `magicAdd` is online-only (the server's AI reads the sentence).
 */
export const tasksApi = {
  /** Delta sync page: `{ cursor?, limit? }` -> `{ items, deleted, next_cursor, has_more, snapshot, server_time }`. */
  changes: (params) => api.get("/tasks", { ...TIMEOUT, params }).then((r) => r.data),
  /** Idempotent per `client_id`: repeating a create returns the reminder that was already stored. */
  create: (payload) => api.post("/tasks", payload, TIMEOUT).then((r) => r.data),
  update: (id, payload) => api.put(`/tasks/${encodeURIComponent(id)}`, payload, TIMEOUT).then((r) => r.data),
  setStatus: (id, status) => api.patch(`/tasks/${encodeURIComponent(id)}`, { status }, TIMEOUT).then((r) => r.data),
  remove: (id) => api.delete(`/tasks/${encodeURIComponent(id)}`, TIMEOUT).then((r) => r.data),
  /** `{ streak, best_streak, completed_today }` on IST calendar days, for the motivation card. */
  stats: () => api.get("/tasks/stats", { timeout: 10000 }).then((r) => r.data),
  magicAdd: (text) => api.post("/tasks/magic-add", { text }).then((r) => r.data),
};
