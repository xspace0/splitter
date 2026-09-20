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
  return request.get('/communities', { params }) as Promise<CommunityListResult>;
}

export function createCommunity(data: { communityName: string; remark?: string }) {
  return request.post('/communities', data) as Promise<{ code: number; data: CommunityItem }>;
}

export function updateCommunity(id: string, data: { communityName?: string; remark?: string }) {
  return request.put(`/communities/${id}`, data) as Promise<{ code: number; data: CommunityItem }>;
}

export function updateCommunityStatus(id: string, status: number) {
  const action = status === 1 ? 'enable' : 'disable';
  return request.post(`/communities/${id}/${action}`) as Promise<{ code: number; data: CommunityItem }>;
}

export function deleteCommunity(id: string) {
  return request.delete(`/communities/${id}`) as Promise<{ code: number; message: string }>;
}
