import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Show message before redirect
      const msg = 'Sua sessão expirou. Faça login novamente.';
      if (!window.location.pathname.includes('/login')) {
        window.location.href = `/login?expired=1`;
      }
    }
    return Promise.reject(err);
  }
);

export default api;
