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
  return request.get<UserListResult>('/users', { params });
}

export function createUser(data: { username: string; account: string; password: string; roleType: string; phone?: string; regionId?: string }) {
  return request.post<{ code: number; data: UserItem }>('/users', data);
}

export function updateUser(id: string, data: { username?: string; phone?: string }) {
  return request.put<{ code: number; data: UserItem }>(`/users/${id}`, data);
}

export function updateUserStatus(id: string, status: number) {
  return request.put<{ code: number; data: UserItem }>(`/users/${id}/status`, { status });
}

export function resetPassword(id: string, newPassword: string) {
  return request.put<{ code: number; message: string }>(`/users/${id}/password`, { newPassword });
}

export function updateUserRole(id: string, roleType: string) {
  return request.put<{ code: number; data: UserItem }>(`/users/${id}/role`, { roleType });
}
