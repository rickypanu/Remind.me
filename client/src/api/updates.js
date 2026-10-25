import api from "../utils/api";

export const updatesApi = {
  list: () => api.get("/updates").then((r) => r.data),
  create: ({ title, content }) => api.post("/updates", { title, content }).then((r) => r.data),
  remove: (id) => api.delete(`/updates/${encodeURIComponent(id)}`).then((r) => r.data),
};
