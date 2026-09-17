import request from '../utils/request';

// 小程序登录（微信一键登录）
export function miniLogin(code) {
  return request.post('/auth/mini-login', { code });
}

// 获取当前用户信息
export function getProfile() {
  return request.get('/auth/profile');
}

// 实名认证
export function submitRealName(data) {
  return request.post('/auth/real-name-auth', data);
}
