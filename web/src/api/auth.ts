import request from '@/utils/request';

export interface LoginPayload {
  account: string;
  password: string;
}

export interface LoginUser {
  id: string;
  account: string | null;
  username: string;
  roleType: string;
  realNameVerified: number;
  regionId: string;
  phone: string | null;
}

export interface LoginResult {
  code: number;
  message: string;
  data: {
    token: string;
    user: LoginUser;
  };
}

/**
 * 后端统一响应信封。
 * axios 响应拦截器（utils/request.ts）返回的是信封整体，而非其内部的 data 字段，
 * 因此调用方需用 res.data.data 取业务数据。
 */
export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
}

export interface ProfileData {
  id: string;
  account: string | null;
  username: string;
  roleType: string;
  realNameVerified: number;
  realNameAuthTime: string | null;
  phone: string | null;
  regionId: string;
  lastLoginTime: string | null;
}

export type ProfileResult = ApiEnvelope<ProfileData>;

export function login(payload: LoginPayload) {
  return request.post<LoginResult>('/auth/login', payload);
}

export function getProfile() {
  return request.get<ProfileResult>('/auth/profile');
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request.put<{ code: number; message: string }>('/auth/password', { oldPassword, newPassword });
}

export function updateProfile(data: { username?: string; phone?: string }) {
  return request.put<{ code: number; message: string }>('/auth/profile', data);
}
