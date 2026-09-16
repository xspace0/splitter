<template>
  <view class="fault-page">
    <!-- 状态筛选 -->
    <view class="filter-tabs">
      <view class="tab-item" :class="{ active: filterStatus === '' }" @click="setStatus('')">
        全部 <text class="tab-count">{{ counts.total }}</text>
      </view>
      <view class="tab-item" :class="{ active: filterStatus === '2' }" @click="setStatus('2')">
        故障中 <text class="tab-count">{{ counts.fault }}</text>
      </view>
      <view class="tab-item" :class="{ active: filterStatus === '1' }" @click="setStatus('1')">
        已恢复 <text class="tab-count">{{ counts.recovered }}</text>
      </view>
    </view>

    <view class="fault-list">
      <view v-for="item in list" :key="item.id" class="fault-card">
        <view class="card-header">
          <view class="device-info">
            <view class="level-dot" :class="'level-' + item.splitterLevel"></view>
            <text class="device-name">{{ item.splitterName }}</text>
          </view>
          <text class="tag" :class="statusTagClass(item.status)">{{ statusName(item.status) }}</text>
        </view>
        <view class="card-body">
          <view class="info-row">
            <text class="info-label">故障类型</text>
            <text class="info-value fault-text">{{ faultTypeName(item.faultType) }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">所属社区</text>
            <text class="info-value">{{ item.communityName || '-' }}</text>
          </view>
          <view class="info-row">
            <text class="info-label">上报时间</text>
            <text class="info-value">{{ formatTime(item.faultTime || item.updateTime) }}</text>
          </view>
          <view v-if="item.status === 1 && item.recoverTime" class="info-row">
            <text class="info-label">恢复时间</text>
            <text class="info-value">{{ formatTime(item.recoverTime) }}</text>
          </view>
          <view v-if="item.remark" class="info-row remark-row">
            <text class="info-label">备注</text>
            <text class="info-value">{{ item.remark }}</text>
          </view>
        </view>
        <view class="card-footer">
          <button v-if="item.status === 2" class="btn btn-recover" @click="recover(item)">故障恢复</button>
          <button v-else class="btn btn-detail" @click="viewDetail(item)">查看详情</button>
        </view>
      </view>

      <view v-if="list.length === 0 && !loading" class="empty-tip">
        <text class="empty-icon">🔧</text>
        <text class="empty-text">暂无故障记录</text>
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
      filterStatus: '',
      loading: false,
      counts: { total: 0, fault: 0, recovered: 0 },
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
    setStatus(status) {
      this.filterStatus = status;
      this.page = 1;
      this.loadList();
    },
    async loadList(append = false) {
      if (!append) this.page = 1;
      this.loading = true;
      try {
        const params = {
          page: this.page,
          pageSize: this.pageSize,
        };
        if (this.filterStatus !== '') params.status = this.filterStatus;
        const res = await this.$api.splitter.getSplitters(params);
        // 筛选故障和已恢复的（简化：故障状态=2的，以及有过故障记录的）
        const faultItems = res.data.list.filter(s => s.status === 2 || s.faultType);
        if (append) {
          this.list = [...this.list, ...faultItems];
        } else {
          this.list = faultItems;
        }
        this.total = res.data.total;
        // 计算统计
        const all = res.data.list;
        this.counts.total = all.length;
        this.counts.fault = all.filter(s => s.status === 2).length;
        this.counts.recovered = all.filter(s => s.status === 1 && s.faultType).length;
      } catch (e) {
        console.error(e);
      } finally {
        this.loading = false;
      }
    },
    statusName(status) {
      const map = { 1: '已恢复', 2: '故障中', 3: '停用', 4: '建设中' };
      return map[status] || '未知';
    },
    statusTagClass(status) {
      const map = { 1: 'tag-green', 2: 'tag-red', 3: 'tag-orange', 4: 'tag-gray' };
      return map[status] || 'tag-gray';
    },
    faultTypeName(type) {
      const map = { 1: '无光', 2: '光衰过大', 3: '断纤', 4: '接头损耗' };
      return map[type] || '-';
    },
    formatTime(time) {
      if (!time) return '-';
      const d = new Date(time);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const min = String(d.getMinutes()).padStart(2, '0');
      return `${y}-${m}-${day} ${h}:${min}`;
    },
    async recover(item) {
      uni.showModal({
        title: '确认恢复',
        content: `确认将「${item.splitterName}」标记为故障恢复？`,
        success: async (res) => {
          if (res.confirm) {
            try {
              await this.$api.splitter.recoverFault(item.id);
              uni.showToast({ title: '恢复成功', icon: 'success' });
              this.loadList();
            } catch (e) {}
          }
        },
      });
    },
    viewDetail(item) {
      uni.showToast({ title: item.splitterName, icon: 'none' });
    },
  },
};
</script>

<style>
.fault-page {
  min-height: 100vh;
  background: #f5f5f5;
}
.filter-tabs {
  display: flex;
  background: #fff;
  padding: 0 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.tab-item {
  flex: 1;
  text-align: center;
  padding: 24rpx 0;
  font-size: 26rpx;
  color: #666;
  position: relative;
}
.tab-item.active {
  color: #07c160;
  font-weight: 500;
}
.tab-item.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 40rpx;
  height: 4rpx;
  background: #07c160;
  border-radius: 2rpx;
}
.tab-count {
  font-size: 22rpx;
  margin-left: 4rpx;
}

.fault-list {
  padding: 20rpx;
}
.fault-card {
  background: #fff;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
  overflow: hidden;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx;
  border-bottom: 1rpx solid #f5f5f5;
}
.device-info {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.level-dot {
  width: 20rpx;
  height: 20rpx;
  border-radius: 50%;
}
.level-1 { background: #e74c3c; }
.level-2 { background: #f39c12; }
.level-3 { background: #3498db; }
.level-4 { background: #27ae60; }
.device-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}
.card-body {
  padding: 20rpx 24rpx;
  font-size: 24rpx;
  line-height: 2;
}
.info-row {
  display: flex;
  justify-content: space-between;
}
.info-label { color: #999; }
.info-value { color: #666; max-width: 60%; text-align: right; }
.fault-text { color: #ff4d4f; }
.remark-row .info-value {
  color: #999;
}
.card-footer {
  padding: 16rpx 24rpx 24rpx;
}
.btn-recover {
  width: 100%;
  background: #07c160;
  color: #fff;
  border-radius: 40rpx;
  font-size: 26rpx;
  border: none;
}
.btn-detail {
  width: 100%;
  background: #f5f5f5;
  color: #666;
  border-radius: 40rpx;
  font-size: 26rpx;
  border: none;
}

.tag {
  display: inline-block;
  padding: 4rpx 12rpx;
  border-radius: 6rpx;
  font-size: 22rpx;
  border: 1rpx solid transparent;
}
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }
.tag-gray { background: #fafafa; color: #999; border-color: #d9d9d9; }

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 0;
}
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-text { font-size: 28rpx; color: #999; }
.loading {
  text-align: center;
  color: #999;
  padding: 60rpx 0;
  font-size: 26rpx;
}
</style>
