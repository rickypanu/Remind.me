import api from "../utils/api";

/** Friends, invite codes, reminders sent to a friend and the accountability buddy. Resolves with the body. */
export const socialApi = {
  summary: () => api.get("/social", { timeout: 15000 }).then((r) => r.data),
  join: (code) => api.post("/social/join", { code }).then((r) => r.data),
  unfriend: (id) => api.delete(`/social/friends/${encodeURIComponent(id)}`).then((r) => r.data),
  remind: (id, payload) => api.post(`/social/friends/${encodeURIComponent(id)}/remind`, payload).then((r) => r.data),
  setBuddy: (friendId) => api.put("/social/buddy", { friend_id: friendId }).then((r) => r.data),
};
