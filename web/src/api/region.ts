import request from '@/utils/request';

export interface RegionItem {
  id: string;
  regionName: string;
  parentId: string | null;
  regionLevel: string;
  regionCode: string | null;
  children?: RegionItem[];
}

export interface RegionTreeItem extends RegionItem {
  children: RegionTreeItem[];
}

export function getRegionTree(parentId?: string) {
  return request.get<{ code: number; message: string; data: RegionTreeItem[] }>(`/regions/tree${parentId ? `?parentId=${parentId}` : ''}`);
}

export function getRegionsByLevel(level: number) {
  return request.get<{ code: number; message: string; data: RegionItem[] }>(`/regions?level=${level}`);
}

export function getRegionChildren(parentId: string) {
  return request.get<{ code: number; message: string; data: RegionItem[] }>(`/regions/${parentId}/children`);
}

export function createRegion(data: Partial<RegionItem> & { regionLevel: number }) {
  return request.post<{ code: number; message: string; data: RegionItem }>('/regions', data);
}

export function updateRegion(id: string, data: Partial<RegionItem>) {
  return request.put<{ code: number; message: string; data: RegionItem }>(`/regions/${id}`, data);
}

export function deleteRegion(id: string) {
  return request.delete<{ code: number; message: string }>(`/regions/${id}`);
}
