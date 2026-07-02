import axios from "axios";

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
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;