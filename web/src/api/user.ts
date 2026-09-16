import request from '@/utils/request';

export interface UserItem {
  id: string;
  username: string;
  account: string;
  roleType: string;
  regionId: string | null;
  phone: string | null;
  realNameVerified: number;
  status: number;
  lastLoginTime: string | null;
  createTime: string;
}

export interface UserListResult {
  code: number;
  data: {
    list: UserItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export function getUsers(params: { page?: number; pageSize?: number; keyword?: string; roleType?: string; status?: number }) {
  return request.get('/users', { params }) as Promise<UserListResult>;
}

export function createUser(data: { username: string; account: string; password: string; roleType: string; phone?: string; regionId?: string }) {
  return request.post('/users', data) as Promise<{ code: number; data: UserItem }>;
}

export function updateUser(id: string, data: { username?: string; phone?: string }) {
  return request.put(`/users/${id}`, data) as Promise<{ code: number; data: UserItem }>;
}

export function updateUserStatus(id: string, status: number) {
  return request.put(`/users/${id}/status`, { status }) as Promise<{ code: number; data: UserItem }>;
}

export function resetPassword(id: string, newPassword: string) {
  return request.put(`/users/${id}/password`, { newPassword }) as Promise<{ code: number; message: string }>;
}

export function updateUserRole(id: string, roleType: string) {
  return request.put(`/users/${id}/role`, { roleType }) as Promise<{ code: number; data: UserItem }>;
}
