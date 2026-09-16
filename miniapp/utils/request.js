const BASE_URL = 'http://101.34.70.210:3000/api';

function request(options) {
  return new Promise((resolve, reject) => {
    const token = uni.getStorageSync('token') || '';
    uni.request({
      url: BASE_URL + options.url,
      method: options.method || 'GET',
      data: options.data || options.params || {},
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
        if (res.data && res.data.code === 0) {
          resolve(res.data);
        } else {
          uni.showToast({ title: res.data?.message || '请求失败', icon: 'none' });
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
