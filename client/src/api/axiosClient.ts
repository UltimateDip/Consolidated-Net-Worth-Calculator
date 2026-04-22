import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3001/api';

const axiosClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Automatically add the auth token to every request
axiosClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('assetaura_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Extract the data payload and unify error handling
axiosClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Return only the data from the response
    return response.data;
  },
  (error) => {
    // Extract backend error message if available, else use generic axios error
    const message = error.response?.data?.error || error.message || 'An unexpected error occurred';
    
    // Auto-logout on token expiration (401)
    if (error.response?.status === 401) {
      localStorage.removeItem('assetaura_token');
      window.dispatchEvent(new Event('auth_expired'));
    }
    
    return Promise.reject(new Error(message));
  }
);

export default axiosClient;
