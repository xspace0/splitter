import request from '../utils/request';

// 分页查询分光器
export function getSplitters(params) {
  return request.get('/splitters', params);
}

// 地图数据
export function getSplitterMapData(params) {
  return request.get('/splitters/map-data', params);
}

// 统计数据
export function getSplitterStats() {
  return request.get('/splitters/stats');
}

// 新增分光器
export function createSplitter(data) {
  return request.post('/splitters', data);
}

// 获取详情
export function getSplitter(id) {
  return request.get(`/splitters/${id}`);
}

// 更新分光器
export function updateSplitter(id, data) {
  return request.put(`/splitters/${id}`, data);
}

// 故障上报
export function reportFault(id, faultType) {
  return request.post(`/splitters/${id}/report-fault`, { faultType });
}

// 故障恢复
export function recoverFault(id) {
  return request.post(`/splitters/${id}/recover-fault`);
}

// 修改状态
export function updateSplitterStatus(id, status, faultType) {
  return request.post(`/splitters/${id}/status`, { status, faultType });
}

// 删除分光器
export function deleteSplitter(id) {
  return request.delete(`/splitters/${id}`);
}
