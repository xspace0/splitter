import request from '@/utils/request';

export interface CommunityItem {
  id: string;
  communityName: string;
  regionId: string | null;
  remark: string | null;
  status: number;
  disableTime: string | null;
  creatorId: string;
  createTime: string;
  updateTime: string;
}

export interface CommunityListResult {
  code: number;
  data: {
    list: CommunityItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export function getCommunities(params: { page?: number; pageSize?: number; keyword?: string; status?: number }) {
  return request.get<CommunityListResult>('/communities', { params });
}

export function createCommunity(data: { communityName: string; remark?: string }) {
  return request.post<{ code: number; data: CommunityItem }>('/communities', data);
}

export function updateCommunity(id: string, data: { communityName?: string; remark?: string }) {
  return request.put<{ code: number; data: CommunityItem }>(`/communities/${id}`, data);
}

export function updateCommunityStatus(id: string, status: number) {
  const action = status === 1 ? 'enable' : 'disable';
  return request.post<{ code: number; data: CommunityItem }>(`/communities/${id}/${action}`);
}

export function deleteCommunity(id: string) {
  return request.delete<{ code: number; message: string }>(`/communities/${id}`);
}
