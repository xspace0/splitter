<template>
  <view class="profile-page">
    <!-- 用户信息头 -->
    <view class="user-header">
      <view class="avatar">{{ avatarChar }}</view>
      <view class="user-meta">
        <view class="user-name">{{ profile.username || '小程序用户' }}</view>
        <view class="user-tags">
          <text class="role-tag" :class="'role-' + roleLevel">{{ roleLabel }}</text>
          <text class="tag" :class="profile.realNameVerified ? 'tag-green' : 'tag-red'">
            {{ profile.realNameVerified ? '已认证' : '未认证' }}
          </text>
        </view>
      </view>
    </view>

    <!-- 基本信息卡片 -->
    <view class="mini-card">
      <view class="card-title">基本信息</view>
      <view class="mini-list-item">
        <text class="label">姓名</text>
        <text class="value">{{ profile.username || '-' }}</text>
      </view>
      <view class="mini-list-item">
        <text class="label">所属区县</text>
        <text class="value">{{ profile.region || '-' }}</text>
      </view>
      <view class="mini-list-item">
        <text class="label">手机号</text>
        <text class="value">{{ profile.phone ? maskPhone(profile.phone) : '未绑定' }}</text>
      </view>
      <view class="mini-list-item" style="border-bottom: none;">
        <text class="label">认证时间</text>
        <text class="value">{{ authTime || '-' }}</text>
      </view>
    </view>

    <!-- 功能列表 -->
    <view class="mini-card" style="padding: 0;">
      <view class="mini-list-item" @click="goCommunities">
        <view class="item-left">
          <text class="item-icon">📋</text>
          <text>我的分配社区</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="mini-list-item" @click="goFaultRecords">
        <view class="item-left">
          <text class="item-icon">🔧</text>
          <text>故障上报记录</text>
        </view>
        <text class="arrow">›</text>
      </view>
      <view class="mini-list-item" style="border-bottom: none;" @click="goAuth">
        <view class="item-left">
          <text class="item-icon">🔐</text>
          <text>实名认证</text>
        </view>
        <view class="item-right">
          <text class="tag" :class="profile.realNameVerified ? 'tag-green' : 'tag-red'">
            {{ profile.realNameVerified ? '已认证' : '未认证' }}
          </text>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>

    <!-- 退出登录 -->
    <view class="mini-card" style="padding: 0;">
      <view class="mini-list-item" style="border-bottom: none;" @click="handleLogout">
        <view class="item-left">
          <text class="item-icon" style="color: #ff4d4f;">📤</text>
          <text style="color: #ff4d4f;">退出登录</text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>

    <view class="version">分光器资源管理系统 v1.0.0</view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      profile: {
        username: '',
        realNameVerified: false,
        roleType: 'VIEWER',
        phone: '',
        region: '',
      },
      authTime: '',
    };
  },
  computed: {
    avatarChar() {
      return this.profile.username ? this.profile.username.charAt(0) : '微';
    },
    roleLevel() {
      const map = { SUPER_ADMIN: 1, REGION_ADMIN: 2, ADMIN: 3, OPERATOR: 4, VIEWER: 5 };
      return map[this.profile.roleType] || 5;
    },
    roleLabel() {
      const map = { SUPER_ADMIN: '超级管理员', REGION_ADMIN: '区域管理员', ADMIN: '管理员', OPERATOR: '操作员', VIEWER: '查看者' };
      return map[this.profile.roleType] || '查看者';
    },
  },
  onShow() {
    this.loadProfile();
  },
  methods: {
    loadProfile() {
      const p = uni.getStorageSync('profile');
      if (p) {
        this.profile = { ...this.profile, ...p };
      }
    },
    maskPhone(phone) {
      if (!phone || phone.length < 7) return phone;
      return phone.substring(0, 3) + '****' + phone.substring(phone.length - 4);
    },
    goAuth() {
      if (this.profile.realNameVerified) {
        uni.showToast({ title: '已认证', icon: 'none' });
        return;
      }
      uni.navigateTo({ url: '/pages/auth/auth' });
    },
    goCommunities() {
      uni.navigateTo({ url: '/pages/my-communities/my-communities' });
    },
    goFaultRecords() {
      uni.navigateTo({ url: '/pages/fault-records/fault-records' });
    },
    handleLogout() {
      uni.showModal({
        title: '提示',
        content: '确定退出登录吗？',
        success: (res) => {
          if (res.confirm) {
            uni.removeStorageSync('token');
            uni.removeStorageSync('profile');
            uni.reLaunch({ url: '/pages/login/login' });
          }
        },
      });
    },
  },
};
</script>

<style>
.profile-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 32rpx;
}
.user-header {
  background: #07c160;
  padding: 40rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
}
.avatar {
  width: 100rpx;
  height: 100rpx;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: #07c160;
  font-weight: 500;
}
.user-meta {
  flex: 1;
}
.user-name {
  color: #fff;
  font-size: 32rpx;
  font-weight: 500;
  margin-bottom: 8rpx;
}
.user-tags {
  display: flex;
  gap: 8rpx;
  align-items: center;
}
.role-tag {
  display: inline-block;
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
  font-size: 22rpx;
  background: rgba(255,255,255,0.2);
  color: #fff;
}
.tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-size: 20rpx;
  border: 1rpx solid transparent;
}
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }

.mini-card {
  background: #fff;
  margin: 20rpx;
  border-radius: 8rpx;
  padding: 24rpx;
}
.card-title {
  font-size: 28rpx;
  font-weight: 500;
  margin-bottom: 16rpx;
}
.mini-list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 28rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  font-size: 28rpx;
}
.label {
  color: #999;
  font-size: 26rpx;
}
.value {
  color: #333;
  font-size: 26rpx;
}
.item-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.item-right {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.item-icon {
  font-size: 32rpx;
}
.arrow {
  color: #ccc;
  font-size: 32rpx;
}
.version {
  text-align: center;
  padding: 32rpx;
  font-size: 22rpx;
  color: #ccc;
}
</style>
