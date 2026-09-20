import request from '@/utils/request';

export interface SplitterItem {
  id: string;
  splitterName: string;
  communityId: string;
  splitterLevel: number;
  parentId: string | null;
  parentName?: string | null;
  parentLevel?: number | null;
  splitRatio: string | null;
  installLocation: string | null;
  longitude: string | null;
  latitude: string | null;
  status: number;
  faultType: number | null;
  remark: string | null;
  operatorId: string;
  creatorId: string;
  createTime: string;
  updateTime: string;
}

export interface SplitterTreeItem extends SplitterItem {
  children: SplitterTreeItem[];
}

export interface SplitterListResult {
  code: number;
  data: {
    list: SplitterItem[];
    total: number;
    page: number;
    pageSize: number;
  };
}

export interface SplitterTreeResult {
  code: number;
  data: SplitterTreeItem[];
}

export function getSplitters(params: {
  page?: number;
  pageSize?: number;
  keyword?: string;
  communityId?: string;
  parentId?: string;
  splitterLevel?: number;
  status?: number;
}) {
  return request.get<SplitterListResult>('/splitters', { params });
}

export function getSplitterTree(communityId: string) {
  return request.get<SplitterTreeResult>(`/splitters/tree/${communityId}`);
}

export function getSplitter(id: string) {
  return request.get<{ code: number; data: SplitterItem }>(`/splitters/${id}`);
}

export function createSplitter(data: {
  splitterName: string;
  communityId: string;
  splitterLevel: number;
  parentId?: string;
  splitRatio?: string;
  installLocation?: string;
  longitude?: string;
  latitude?: string;
  status?: number;
  remark?: string;
}) {
  return request.post<{ code: number; data: SplitterItem }>('/splitters', data);
}

export function updateSplitter(
  id: string,
  data: {
    splitterName?: string;
    parentId?: string;
    splitRatio?: string;
    installLocation?: string;
    longitude?: string;
    latitude?: string;
    remark?: string;
  },
) {
  return request.put<{ code: number; data: SplitterItem }>(`/splitters/${id}`, data);
}

export function updateSplitterStatus(id: string, status: number, faultType?: number) {
  return request.post<{ code: number; data: SplitterItem }>(`/splitters/${id}/status`, { status, faultType });
}

export function deleteSplitter(id: string) {
  return request.delete<{ code: number; message: string }>(`/splitters/${id}`);
}
