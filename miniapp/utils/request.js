const BASE_URL = 'http://1.92.79.114:3001/api';

// 错误码
const ERR_CODE_UNVERIFIED = 2001; // 未实名认证

function buildQuery(params) {
  if (!params) return '';
  const pairs = [];
  for (const key in params) {
    if (params[key] !== '' && params[key] !== undefined && params[key] !== null) {
      pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`);
    }
  }
  return pairs.length ? '?' + pairs.join('&') : '';
}

// 防止多次跳转
let isRedirecting = false;

function redirectToLogin() {
  if (isRedirecting) return;
  isRedirecting = true;
  uni.removeStorageSync('token');
  uni.removeStorageSync('profile');
  uni.reLaunch({ url: '/pages/login/login' });
  setTimeout(() => { isRedirecting = false; }, 1000);
}

function redirectToProfile() {
  if (isRedirecting) return;
  isRedirecting = true;
  uni.showToast({ title: '请先完成实名认证', icon: 'none' });
  setTimeout(() => {
    uni.switchTab({
      url: '/pages/profile/profile',
      complete: () => { isRedirecting = false; },
    });
  }, 800);
}

function request(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || '';
    let url = BASE_URL + options.url;
    let data = options.data;

    if (options.method === 'GET' && options.params) {
      url += buildQuery(options.params);
    }

    uni.request({
      url,
      method: options.method || 'GET',
      data: data || {},
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
      success: (res) => {
        // 401 token失效
        if (res.statusCode === 401) {
          redirectToLogin();
          reject(res);
          return;
        }
        // 403 业务权限错误
        if (res.statusCode === 403) {
          const code = res.data?.code;
          if (code === ERR_CODE_UNVERIFIED) {
            // 未实名认证，跳个人中心
            redirectToProfile();
          } else {
            uni.showToast({ title: res.data?.message || '无权限操作', icon: 'none' });
          }
          reject(res.data);
          return;
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (res.data && res.data.code === 0) {
            resolve(res.data);
          } else {
            uni.showToast({ title: res.data?.message || '请求失败', icon: 'none' });
            reject(res.data);
          }
        } else {
          uni.showToast({ title: res.data?.message || `请求错误(${res.statusCode})`, icon: 'none' });
          reject(res.data);
        }
      },
      fail: (err) => {
        uni.showToast({ title: '网络错误', icon: 'none' });
        reject(err);
      },
    });
  });
}

export default {
  get(url, params) { return request({ url, method: 'GET', params }); },
  post(url, data) { return request({ url, method: 'POST', data }); },
  put(url, data) { return request({ url, method: 'PUT', data }); },
  delete(url) { return request({ url, method: 'DELETE' }); },
};
