<template>
  <view class="community-page">
    <view class="search-bar">
      <input v-model="keyword" class="search-input" placeholder="搜索社区名称" confirm-type="search" @confirm="loadList" />
    </view>

    <view class="stat-bar">
      <text>共分配 <text class="num">{{ total }}</text> 个社区</text>
    </view>

    <view class="community-list">
      <view v-for="item in list" :key="item.id" class="community-card" @click="onClick(item)">
        <view class="card-header">
          <text class="community-name">{{ item.communityName }}</text>
          <text class="tag" :class="item.status === 1 ? 'tag-green' : 'tag-orange'">
            {{ item.status === 1 ? '正常' : '停用' }}
          </text>
        </view>
        <view class="card-info">
          <view class="info-row">
            <text class="info-label">所属区县</text>
            <text class="info-value">{{ item.regionName || '-' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">设备数量</text>
            <text class="info-value">{{ item.splitterCount || 0 }} 个</text>
          </view>
          <view class="info-row">
            <text class="info-label">分配时间</text>
            <text class="info-value">{{ item.assignTime || '-' }}</text>
          </view>
        </view>
      </view>

      <view v-if="list.length === 0 && !loading" class="empty-tip">
        <text class="empty-icon">📋</text>
        <text class="empty-text">暂无分配的社区</text>
        <text class="empty-desc">请联系管理员分配社区权限</text>
      </view>
      <view v-if="loading" class="loading">加载中...</view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      keyword: '',
      loading: false,
    };
  },
  onLoad() {
    this.loadList();
  },
  onReachBottom() {
    if (this.list.length < this.total) {
      this.page++;
      this.loadList(true);
    }
  },
  methods: {
    async loadList(append = false) {
      if (!append) this.page = 1;
      this.loading = true;
      try {
        // 调用权限接口查询当前用户已分配的社区
        const userId = uni.getStorageSync('profile')?.id;
        if (!userId) {
          this.list = [];
          this.total = 0;
          return;
        }
        const res = await this.$api.community.getCommunities({
          page: this.page,
          pageSize: this.pageSize,
          keyword: this.keyword || undefined,
        });
        // 后端后续可加 myCommunities 接口，这里先用全部社区模拟
        if (append) {
          this.list = [...this.list, ...res.data.list];
        } else {
          this.list = res.data.list;
        }
        this.total = res.data.total;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
    onClick(item) {
      uni.showToast({ title: item.communityName, icon: 'none' });
    },
  },
};
</script>

<style>
.community-page {
  min-height: 100vh;
  background: #f5f5f5;
}
.search-bar {
  background: #fff;
  padding: 20rpx 24rpx;
}
.search-input {
  width: 100%;
  height: 72rpx;
  background: #f5f5f5;
  border-radius: 36rpx;
  padding: 0 32rpx;
  font-size: 26rpx;
}
.stat-bar {
  padding: 16rpx 24rpx;
  font-size: 24rpx;
  color: #666;
}
.num {
  color: #07c160;
  font-weight: bold;
}
.community-list {
  padding: 0 20rpx;
}
.community-card {
  background: #fff;
  border-radius: 8rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}
.community-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}
.card-info {
  font-size: 24rpx;
  color: #999;
  line-height: 2;
}
.info-row {
  display: flex;
  justify-content: space-between;
}
.info-label { color: #999; }
.info-value { color: #666; }

.tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  border: 1rpx solid transparent;
}
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #999; margin-bottom: 8rpx; }
.empty-desc { font-size: 24rpx; color: #ccc; }
.loading {
  text-align: center;
  color: #999;
  padding: 60rpx 0;
  font-size: 26rpx;
}
</style>
