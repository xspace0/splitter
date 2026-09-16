import request from './request';

// 获取社区列表（只返回已分配的，用于小程序）
export function getMyCommunities() {
  return request.get('/communities/my');
}

// 获取社区列表
export function getCommunities(params) {
  return request.get('/communities', params);
}
