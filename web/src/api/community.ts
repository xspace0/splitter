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

/**
 * 按角色获取「可用于下拉选择」的社区列表。
 * 社区管理接口 /communities 仅对超管/区域管理员/管理员开放，
 * 操作员与查看者必须走各自的专用接口，否则会拿到 403、下拉框空白。
 */
export interface CommunityOption {
  id: string;
  communityName: string;
  status: number;
  regionId?: string;
}

export function getMyCommunities() {
  return request.get<{ code: number; data: { list: CommunityOption[]; total: number } }>('/communities/my');
}

export function getMapCommunityOptions() {
  return request.get<{ code: number; data: { list: CommunityOption[] } }>('/communities/map-options');
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
