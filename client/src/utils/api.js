import axios from "axios";
import { getToken, getRefreshToken, setSession, clearSession, signalAuthExpired } from "./auth";

// Replace with your actual backend URL if it's not hosted on the same domain
// Every API route lives under /v1 (no trailing slashes; the server no longer redirects).
export const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const baseURL = `${API_ORIGIN}/v1`;

// Create an Axios instance
const api = axios.create({
  baseURL,
  headers: {
    "Content-Type": "application/json",
  },
});

// A second instance WITHOUT the interceptors below, used only to renew / end the session, so a failing
// refresh can never trigger another refresh.
const authClient = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Automatically attach the short-lived access token to every request
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// --- silent token refresh -------------------------------------------------------------------------
// Access tokens live for about 15 minutes. When one is rejected, trade the refresh token for a new pair
// ONCE (all requests that fail at the same moment share that one refresh), then repeat the request.
// Only if the session truly cannot be renewed (refresh token expired, revoked, reused, or the password
// was reset) does the user get signed out. A flaky connection never signs anyone out.

const NO_REFRESH_URLS = /^\/?auth\/(login|signup|refresh|logout|forgot-password|reset-password)/;
const AUTH_FAILURE_STATUSES = new Set([400, 401, 403, 422]);

let refreshInFlight = null;

async function exchange(refreshToken) {
  const { data } = await authClient.post("/auth/refresh", { refresh_token: refreshToken });
  setSession(data);
  return data.access_token;
}

async function renewSession(staleAccessToken) {
  const run = async () => {
    // Another tab may have renewed the session while this one waited for the lock.
    const current = getToken();
    if (current && current !== staleAccessToken) return current;

    const used = getRefreshToken();
    if (!used) {
      const error = new Error("No refresh token");
      error.authFailure = true;
      throw error;
    }
    try {
      return await exchange(used);
    } catch (error) {
      // Two tabs refreshing in the same instant: the loser is refused but the winner has already stored a
      // newer token. Give it a moment, and if one appeared, use it.
      if (error.response?.status === 401) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const latest = getRefreshToken();
        if (latest && latest !== used) return getToken() ?? exchange(latest);
      }
      throw error;
    }
  };
  // Web Locks makes the check-then-refresh atomic across tabs. Without it (old browsers) the 401 fallback above
  // covers the same race.
  if (typeof navigator !== "undefined" && navigator.locks?.request) {
    return navigator.locks.request("remindme-token-refresh", run);
  }
  return run();
}

// If the server rejects our token and the session cannot be renewed, sign out cleanly.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const url = original?.url || "";

    if (status !== 401 || !original || original._retried || NO_REFRESH_URLS.test(url)) {
      return Promise.reject(error);
    }

    const hadToken = !!getToken() || !!getRefreshToken();
    if (!hadToken) return Promise.reject(error); // not logged in: nothing to renew

    original._retried = true;
    const stale = getToken();
    try {
      refreshInFlight ??= renewSession(stale).finally(() => {
        refreshInFlight = null;
      });
      const accessToken = await refreshInFlight;
      original.headers = original.headers ?? {};
      original.headers.Authorization = `Bearer ${accessToken}`;
      return api(original);
    } catch (refreshError) {
      const rejected = refreshError.authFailure || AUTH_FAILURE_STATUSES.has(refreshError.response?.status);
      if (rejected) {
        clearSession({ keepOffline: true });
        signalAuthExpired();
      }
      // offline / server down / rate limited: keep the session and let the caller handle the original error
      return Promise.reject(error);
    }
  }
);

/** Tell the server to end this device's session. Never throws: logging out must always work locally. */
export async function logoutFromServer() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return;
  try {
    await authClient.post("/auth/logout", { refresh_token: refreshToken }, { timeout: 5000 });
  } catch {
    /* offline or already expired: the local sign-out still happens */
  }
}

export default api;
