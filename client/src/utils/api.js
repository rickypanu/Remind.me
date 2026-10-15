import axios from "axios";
import { getToken, clearSession, signalAuthExpired } from "./auth";

// Create an Axios instance
const api = axios.create({
  // Replace with your actual backend URL if it's not hosted on the same domain
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000", 
  headers: {
    "Content-Type": "application/json",
  },
});

// Automatically attach the JWT token to every request
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

// If the server rejects our token (expired, or the account was deleted), sign out cleanly.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = !!getToken();
    if (error.response?.status === 401 && hadToken) {
      clearSession();
      signalAuthExpired();
    }
    return Promise.reject(error);
  }
);

export default api;