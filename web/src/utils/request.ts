import axios from 'axios';
import { getToken, clearAuth } from './auth';

const baseURL =
  window.__CONFIG__?.API_BASE_URL || '/api';

const ERR_UNVERIFIED = 2001;

const request = axios.create({
  baseURL,
  timeout: 10000,
});

request.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

request.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error.response?.status;
    const data = error.response?.data;

    if (status === 401) {
      clearAuth();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (status === 403) {
      const code = data?.code;
      if (code === ERR_UNVERIFIED) {
        // 未实名认证，跳个人中心
        window.location.href = '/profile?reason=unverified';
      }
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export default request;
