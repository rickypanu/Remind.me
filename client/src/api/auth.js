import api from "../utils/api";

export const authApi = {
  /** The server expects the OAuth2 password form: `username` carries the e-mail address. */
  login: ({ email, password }) => {
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);
    return api
      .post("/auth/login", params, { headers: { "Content-Type": "application/x-www-form-urlencoded" } })
      .then((r) => r.data);
  },
  signup: ({ username, email, password }) => api.post("/auth/signup", { username, email, password }).then((r) => r.data),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }).then((r) => r.data),
  resetPassword: (payload) => api.post("/auth/reset-password", payload).then((r) => r.data),
};
