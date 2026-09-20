<template>
  <view class="login-page">
    <view class="login-content">
      <view class="logo-box">
        <text class="logo-icon">📡</text>
      </view>
      <view class="title">分光器资源管理系统</view>
      <view class="subtitle">属地化运维管理平台</view>

      <button class="btn-login" @click="handleLogin">
        <text class="wx-icon">💚</text>
        <text>微信一键登录</text>
      </button>

      <view class="agreement">
        <text>登录即表示同意《用户协议》和《隐私政策》</text>
        <text>登录后需完成实名认证方可使用系统</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      logging: false,
    };
  },
  onLoad() {
    // 已登录直接跳转（未认证跳我的，已认证跳地图）
    const token = uni.getStorageSync('token');
    if (token) {
      const profile = uni.getStorageSync('profile') || {};
      if (profile.realNameVerified) {
        uni.switchTab({ url: '/pages/map/map' });
      } else {
        uni.switchTab({ url: '/pages/profile/profile' });
      }
    }
  },
  methods: {
    handleLogin() {
      if (this.logging) return;
      this.logging = true;
      uni.login({
        provider: 'weixin',
        success: (res) => {
          this.doLogin(res.code);
        },
        fail: () => {
          this.logging = false;
          uni.showToast({ title: '微信登录失败', icon: 'none' });
        },
      });
    },
    async doLogin(code) {
      try {
        const res = await this.$api.auth.miniLogin(code);
        uni.setStorageSync('token', res.data.token);
        uni.setStorageSync('profile', res.data.user);
        uni.showToast({ title: '登录成功', icon: 'success' });
        setTimeout(() => {
          // 未实名认证跳我的页面，已认证跳地图
          if (res.data.user && res.data.user.realNameVerified) {
            uni.switchTab({ url: '/pages/map/map' });
          } else {
            uni.switchTab({ url: '/pages/profile/profile' });
          }
        }, 800);
      } catch (e) {
        this.logging = false;
      }
    },
  },
};
</script>

<style>
.login-page {
  min-height: 100vh;
  background: #f5f5f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 160rpx;
}
.login-content {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.logo-box {
  width: 144rpx;
  height: 144rpx;
  border-radius: 32rpx;
  background: #07c160;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 48rpx;
}
.logo-icon {
  font-size: 64rpx;
}
.title {
  font-size: 36rpx;
  font-weight: 500;
  color: #333;
  margin-bottom: 16rpx;
}
.subtitle {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 96rpx;
}
.btn-login {
  width: 80%;
  height: 88rpx;
  background: #07c160;
  color: #fff;
  border-radius: 44rpx;
  font-size: 30rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  border: none;
}
.btn-login:active {
  background: #06ad56;
}
.wx-icon {
  font-size: 36rpx;
}
.agreement {
  margin-top: 64rpx;
  text-align: center;
  font-size: 24rpx;
  color: #999;
  line-height: 1.8;
  padding: 0 64rpx;
}
</style>
