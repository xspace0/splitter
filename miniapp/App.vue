<script>
import * as auth from './api/auth.js';
import * as splitter from './api/splitter.js';
import * as community from './api/community.js';

export default {
  onLaunch() {
    console.log('App Launch');
    // 全局注入API
    uni.$api = { auth, splitter, community };
    // 全局权限检查方法
    uni.$auth = {
      // 是否已登录
      isLoggedIn() {
        return !!uni.getStorageSync('token');
      },
      // 是否已实名认证
      isVerified() {
        const profile = uni.getStorageSync('profile') || {};
        return !!profile.realNameVerified;
      },
      // 获取用户角色
      getRole() {
        const profile = uni.getStorageSync('profile') || {};
        return profile.roleType || 'VIEWER';
      },
      // 是否为查看者
      isViewer() {
        return this.getRole() === 'VIEWER';
      },
      // 检查认证，未认证跳我的页面
      requireVerified(tabUrl) {
        if (!this.isLoggedIn()) {
          uni.reLaunch({ url: '/pages/login/login' });
          return false;
        }
        if (!this.isVerified()) {
          uni.showToast({ title: '请先完成实名认证', icon: 'none' });
          setTimeout(() => {
            uni.switchTab({ url: '/pages/profile/profile' });
          }, 800);
          return false;
        }
        return true;
      },
    };
  },
  onShow() {
    console.log('App Show');
  },
  onHide() {
    console.log('App Hide');
  },
};
</script>

<style>
/*每个页面公共css */
</style>
