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

export interface ProfileResult {
  code: number;
  message: string;
  data: {
    id: string;
    account: string | null;
    username: string;
    roleType: string;
    realNameVerified: number;
    realNameAuthTime: string | null;
    phone: string | null;
    regionId: string;
    lastLoginTime: string | null;
  };
}

export function login(payload: LoginPayload) {
  return request.post('/auth/login', payload) as Promise<LoginResult>;
}

export function getProfile() {
  return request.get('/auth/profile') as Promise<ProfileResult>;
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request.put('/auth/password', { oldPassword, newPassword }) as Promise<{ code: number; message: string }>;
}

export function updateProfile(data: { username?: string; phone?: string }) {
  return request.put('/auth/profile', data) as Promise<{ code: number; message: string }>;
}
