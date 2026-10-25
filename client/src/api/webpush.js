import api from "../utils/api";

export const webpushApi = {
  subscribe: (subscription) => api.post("/integrations/webpush/subscribe", { subscription }).then((r) => r.data),
  unsubscribe: (endpoint) => api.post("/integrations/webpush/unsubscribe", { endpoint }).then((r) => r.data),
};
