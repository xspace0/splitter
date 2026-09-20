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

  <!-- 占位：避免固定定位的 tabbar 遮挡页面底部内容（全屏地图页面可传 :placeholder="false"） -->
  <view v-if="placeholder" class="tabbar-placeholder"></view>
</template>

<script>
// 自定义 tabBar 组件。
// pages.json 中声明了 "tabBar": { "custom": true }，微信小程序要求自定义 tabBar
// 组件必须位于 components/custom-tabbar/index 路径，并由各 tab 页面显式引入。
export default {
  name: 'CustomTabbar',
  props: {
    /** 当前页面 route，例如 'pages/map/map' */
    current: { type: String, default: '' },
    /** 是否输出底部占位块 */
    placeholder: { type: Boolean, default: true },
  },
  data() {
    return {
      fallbackPath: '',
      allTabs: [
        { pagePath: 'pages/map/map', text: '地图', icon: '🗺️' },
        { pagePath: 'pages/splitter/splitter', text: '设备', icon: '📊', requireOperator: true },
        { pagePath: 'pages/profile/profile', text: '我的', icon: '👤' },
      ],
    };
  },
  computed: {
    currentPath() {
      if (this.current) return this.current;
      const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
      return pages.length ? pages[pages.length - 1].route : this.fallbackPath;
    },
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

.tabbar-placeholder {
  height: 100rpx;
  width: 100%;
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
