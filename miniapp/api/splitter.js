import request from './request';

// 分页查询分光器
export function getSplitters(params) {
  return request.get('/splitters', params);
}

// 获取树形结构
export function getSplitterTree(communityId) {
  return request.get(`/splitters/tree/${communityId}`);
}

// 新增分光器
export function createSplitter(data) {
  return request.post('/splitters', data);
}

// 获取详情
export function getSplitter(id) {
  return request.get(`/splitters/${id}`);
}

// 故障上报
export function reportFault(id, faultType, remark) {
  return request.put(`/splitters/${id}/status`, { status: 2, faultType, remark });
}

// 故障恢复
export function recoverFault(id) {
  return request.put(`/splitters/${id}/status`, { status: 1 });
}
