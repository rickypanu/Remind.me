import api from "../utils/api";

/** Profile endpoints. Every function resolves with the response body, never an axios response. */
export const userApi = {
  me: (config) => api.get("/user/me", config).then((r) => r.data),
  rename: (username) => api.patch("/user/me", { username }).then((r) => r.data),
  setAvatarUrl: (avatarUrl) => api.patch("/user/me", { avatar_url: avatarUrl }).then((r) => r.data),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append("avatar", file);
    return api
      .post("/user/avatar", form, { headers: { "Content-Type": "multipart/form-data" } })
      .then((r) => r.data);
  },
  remove: () => api.delete("/user/me").then((r) => r.data),
};
