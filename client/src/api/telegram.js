import api from "../utils/api";

export const telegramApi = {
  status: () => api.get("/integrations/telegram/status").then((r) => r.data),
  /** The server knows who you are from the login; the link is single-use and expires. */
  createLink: () => api.post("/integrations/telegram/get-link").then((r) => r.data),
  disconnect: () => api.post("/integrations/telegram/disconnect").then((r) => r.data),
};
