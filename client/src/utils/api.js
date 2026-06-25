import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL, 
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    // Check if the URL is an auth route. If it is, skip adding the token.
    const isAuthRoute = config.url && config.url.includes('/auth/');
    
    if (token && !isAuthRoute) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;