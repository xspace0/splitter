import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';
import { getToken, clearAuth } from './auth';

const baseURL =
  window.__CONFIG__?.API_BASE_URL || '/api';

const ERR_UNVERIFIED = 2001;

const request = axios.create({
  baseURL,
  timeout: 10000,
});

/**
 * 说明：响应拦截器把 axios 响应替换成了「后端信封」本身（{ code, message, data }），
 * 因此这里导出的实例方法在类型上也应直接返回信封类型 T，而不是 AxiosResponse<T>。
 * 这样各 api 模块可以用 request.get<T>(...) 声明真实契约，
 * 不必再写 `as unknown as Promise<T>` 这类会掩盖错误的强转。
 */
interface ApiClient {
  get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
  post<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  put<T = any>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T>;
  delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T>;
}

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

export default request as unknown as ApiClient;
