<template>
  <view class="custom-tabbar">
    <view
      v-for="item in visibleTabs"
      :key="item.pagePath"
      class="tab-item"
      :class="{ active: currentPath === item.pagePath }"
      @click="switchTab(item)"
    >
      <text class="tab-icon">{{ item.icon }}</text>
      <text class="tab-text">{{ item.text }}</text>
    </view>
  </view>
</template>

<script>
export default {
  name: 'CustomTabbar',
  data() {
    return {
      currentPath: '',
      allTabs: [
        { pagePath: 'pages/map/map', text: '地图', icon: '🗺️' },
        { pagePath: 'pages/splitter/splitter', text: '设备', icon: '📊', requireOperator: true },
        { pagePath: 'pages/profile/profile', text: '我的', icon: '👤' },
      ],
    };
  },
  computed: {
    visibleTabs() {
      const profile = uni.getStorageSync('profile') || {};
      const role = profile.roleType || 'VIEWER';
      return this.allTabs.filter((tab) => {
        if (tab.requireOperator) {
          return role !== 'VIEWER';
        }
        return true;
      });
    },
  },
  methods: {
    updateCurrent(path) {
      this.currentPath = path;
    },
    switchTab(item) {
      if (this.currentPath === item.pagePath) return;
      uni.switchTab({ url: '/' + item.pagePath });
    },
  },
};
</script>

<style scoped>
.custom-tabbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-around;
  height: 100rpx;
  background: #ffffff;
  border-top: 1rpx solid #e5e5e5;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 999;
  padding-bottom: env(safe-area-inset-bottom);
}

.tab-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.tab-icon {
  font-size: 40rpx;
  line-height: 1;
}

.tab-text {
  font-size: 22rpx;
  color: #999999;
  margin-top: 4rpx;
}

.tab-item.active .tab-text {
  color: #07c160;
}
</style>
