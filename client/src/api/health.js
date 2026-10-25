import api, { API_ORIGIN } from "../utils/api";

export const healthApi = {
  /** `/health` is not versioned, so it bypasses the `/v1` base URL. Resolves true / false, never throws. */
  check: ({ signal, timeout = 45000 } = {}) =>
    api
      .get("/health", { baseURL: API_ORIGIN, signal, timeout, validateStatus: () => true })
      .then((r) => r.status >= 200 && r.status < 300)
      .catch(() => false),
};
