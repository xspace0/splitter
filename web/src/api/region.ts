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
  return request.get(`/regions/tree${parentId ? `?parentId=${parentId}` : ''}`) as Promise<{ code: number; message: string; data: RegionTreeItem[] }>;
}

export function getRegionsByLevel(level: number) {
  return request.get(`/regions?level=${level}`) as Promise<{ code: number; message: string; data: RegionItem[] }>;
}

export function getRegionChildren(parentId: string) {
  return request.get(`/regions/${parentId}/children`) as Promise<{ code: number; message: string; data: RegionItem[] }>;
}

export function createRegion(data: Partial<RegionItem> & { regionLevel: number }) {
  return request.post('/regions', data) as Promise<{ code: number; message: string; data: RegionItem }>;
}

export function updateRegion(id: string, data: Partial<RegionItem>) {
  return request.put(`/regions/${id}`, data) as Promise<{ code: number; message: string; data: RegionItem }>;
}

export function deleteRegion(id: string) {
  return request.delete(`/regions/${id}`) as Promise<{ code: number; message: string }>;
}
