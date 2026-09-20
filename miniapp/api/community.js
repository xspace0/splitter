import request from '../utils/request';

// 获取地图社区下拉选项（按角色自动返回对应范围）
export function getMapCommunityOptions() {
  return request.get('/communities/map-options');
}

// 操作员获取已分配的社区列表
export function getMyCommunities() {
  return request.get('/communities/my');
}

// 获取社区列表（PC端用，小程序端不建议直接调用）
export function getCommunities(params) {
  return request.get('/communities', params);
}
