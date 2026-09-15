import request from '@/utils/request';

export interface LoginPayload {
  account: string;
  password: string;
}

export interface LoginResult {
  code: number;
  message: string;
  data: {
    token: string;
    user: {
      id: string;
      account: string;
      username: string;
      roleType: string;
      realNameVerified: number;
    };
  };
}

export interface ProfileResult {
  code: number;
  message: string;
  data: {
    id: string;
    account: string;
    username: string;
    roleType: string;
    realNameVerified: number;
    phone: string | null;
    lastLoginTime: string | null;
  };
}

export function login(payload: LoginPayload) {
  return request.post('/auth/login', payload) as Promise<LoginResult>;
}

export function getProfile() {
  return request.get('/auth/profile') as Promise<ProfileResult>;
}
