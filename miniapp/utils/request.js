const BASE_URL = 'http://1.92.79.114:3001/api';

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
        if (res.statusCode === 401) {
          uni.removeStorageSync('token');
          uni.removeStorageSync('profile');
          uni.reLaunch({ url: '/pages/login/login' });
          reject(res);
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
