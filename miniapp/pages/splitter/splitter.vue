<template>
  <view class="splitter-page">
    <!-- 搜索筛选 -->
    <view class="search-bar">
      <input v-model="keyword" class="search-input" placeholder="搜索设备名称" confirm-type="search" @confirm="loadList" />
    </view>
    <view class="filter-bar">
      <picker :range="communityOptions" range-key="label" @change="onCommunityChange" class="filter-picker">
        <view class="picker-text">{{ selectedCommunityLabel }} ▾</view>
      </picker>
      <picker :range="levelOptions" range-key="label" @change="onLevelChange" class="filter-picker">
        <view class="picker-text">{{ selectedLevelLabel }} ▾</view>
      </picker>
      <picker :range="statusOptions" range-key="label" @change="onStatusChange" class="filter-picker">
        <view class="picker-text">{{ selectedStatusLabel }} ▾</view>
      </picker>
    </view>

    <!-- 统计条 -->
    <view class="stat-bar">
      <text>共 <text class="stat-num total">{{ total }}</text> 条</text>
      <text>正常 <text class="stat-num normal">{{ stats.normal }}</text></text>
      <text>故障 <text class="stat-num fault">{{ stats.fault }}</text></text>
      <text>停用 <text class="stat-num stopped">{{ stats.stopped }}</text></text>
      <text>建设中 <text class="stat-num building">{{ stats.building }}</text></text>
    </view>

    <!-- 设备列表 -->
    <view class="device-list">
      <view v-for="item in list" :key="item.id" class="device-card" @click="onDeviceClick(item)">
        <view class="card-header">
          <view class="device-name-row">
            <view class="level-dot" :class="'level-' + item.splitterLevel" :class="{ 'dot-fault': item.status === 2 }"></view>
            <text class="device-name">{{ item.splitterName }}</text>
          </view>
          <text class="tag" :class="statusTagClass(item.status)">{{ statusName(item.status) }}</text>
        </view>
        <view class="card-info">
          <view class="info-item"><text class="info-label">所属社区：</text><text class="info-value">{{ item.communityName || '-' }}</text></view>
          <view class="info-item"><text class="info-label">设备级别：</text><text class="info-value">{{ levelName(item.splitterLevel) }}（级别{{ item.splitterLevel }}）</text></view>
          <view v-if="item.splitRatio" class="info-item"><text class="info-label">分路比：</text><text class="info-value">{{ item.splitRatio }}</text></view>
          <view v-if="item.faultType && item.status === 2" class="info-item"><text class="info-label">故障类型：</text><text class="info-value fault-text">{{ faultTypeName(item.faultType) }}</text></view>
        </view>
      </view>

      <view v-if="list.length === 0 && !loading" class="empty-tip">暂无设备数据</view>
      <view v-if="loading" class="loading">加载中...</view>
    </view>

    <!-- 浮动添加按钮 -->
    <view class="fab-btn" @click="goAdd">+</view>

    <!-- 设备详情弹窗 -->
    <view v-if="showDetail" class="modal-mask" @click="showDetail = false">
      <view class="detail-modal" @click.stop>
        <view class="detail-header">
          <text class="detail-title">设备详情</text>
          <text class="close-btn" @click="showDetail = false">✕</text>
        </view>
        <view class="detail-body" v-if="currentDevice">
          <view class="detail-row"><text class="d-label">设备名称</text><text class="d-value">{{ currentDevice.splitterName }}</text></view>
          <view class="detail-row"><text class="d-label">设备级别</text><text class="d-value">{{ levelName(currentDevice.splitterLevel) }}</text></view>
          <view class="detail-row"><text class="d-label">状态</text><text><text class="tag" :class="statusTagClass(currentDevice.status)">{{ statusName(currentDevice.status) }}</text></text></view>
          <view class="detail-row"><text class="d-label">所属社区</text><text class="d-value">{{ currentDevice.communityName || '-' }}</text></view>
          <view class="detail-row"><text class="d-label">分路比</text><text class="d-value">{{ currentDevice.splitRatio || '-' }}</text></view>
          <view class="detail-row"><text class="d-label">安装位置</text><text class="d-value">{{ currentDevice.installLocation || '-' }}</text></view>
          <view v-if="currentDevice.faultType && currentDevice.status === 2" class="detail-row"><text class="d-label">故障类型</text><text class="d-value fault-text">{{ faultTypeName(currentDevice.faultType) }}</text></view>
          <view class="detail-row"><text class="d-label">备注</text><text class="d-value">{{ currentDevice.remark || '-' }}</text></view>
        </view>
        <view class="detail-footer">
          <button v-if="currentDevice && currentDevice.status === 1" class="btn btn-fault" @click="reportFault">故障上报</button>
          <button v-if="currentDevice && currentDevice.status === 2" class="btn btn-primary" @click="recoverFault">故障恢复</button>
        </view>
      </view>
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
      filterCommunity: '',
      filterLevel: '',
      filterStatus: '',
      communities: [],
      loading: false,
      showDetail: false,
      currentDevice: null,
      stats: { normal: 0, fault: 0, stopped: 0, building: 0 },
      communityOptions: [{ value: '', label: '全部社区' }],
      levelOptions: [
        { value: '', label: '全部级别' },
        { value: 1, label: '光交' },
        { value: 2, label: '一级' },
        { value: 3, label: '二级' },
        { value: 4, label: '成端' },
      ],
      statusOptions: [
        { value: '', label: '全部状态' },
        { value: 1, label: '正常' },
        { value: 2, label: '故障' },
        { value: 3, label: '停用' },
        { value: 4, label: '建设中' },
      ],
    };
  },
  computed: {
    selectedCommunityLabel() {
      const o = this.communityOptions.find(c => c.value === this.filterCommunity);
      return o ? o.label : '全部社区';
    },
    selectedLevelLabel() {
      const o = this.levelOptions.find(l => String(l.value) === String(this.filterLevel));
      return o ? o.label : '全部级别';
    },
    selectedStatusLabel() {
      const o = this.statusOptions.find(s => String(s.value) === String(this.filterStatus));
      return o ? o.label : '全部状态';
    },
  },
  onShow() {
    this.loadCommunities();
    this.loadList();
  },
  onReachBottom() {
    if (this.list.length < this.total) {
      this.page++;
      this.loadList(true);
    }
  },
  methods: {
    async loadCommunities() {
      try {
        const res = await this.$api.community.getCommunities({ page: 1, pageSize: 100 });
        this.communities = res.data.list;
        this.communityOptions = [
          { value: '', label: '全部社区' },
          ...res.data.list.map(c => ({ value: c.id, label: c.communityName })),
        ];
      } catch (e) {
        console.error('加载社区失败', e);
      }
    },
    async loadList(append = false) {
      if (!append) { this.page = 1; }
      this.loading = true;
      try {
        const params = { page: this.page, pageSize: this.pageSize };
        if (this.keyword) params.keyword = this.keyword;
        if (this.filterCommunity) params.communityId = this.filterCommunity;
        if (this.filterLevel !== '') params.splitterLevel = this.filterLevel;
        if (this.filterStatus !== '') params.status = this.filterStatus;
        const res = await this.$api.splitter.getSplitters(params);
        if (append) {
          this.list = [...this.list, ...res.data.list];
        } else {
          this.list = res.data.list;
        }
        this.total = res.data.total;
        // 计算统计
        this.stats.normal = this.list.filter(s => s.status === 1).length;
        this.stats.fault = this.list.filter(s => s.status === 2).length;
        this.stats.stopped = this.list.filter(s => s.status === 3).length;
        this.stats.building = this.list.filter(s => s.status === 4).length;
      } catch (e) {
        console.error('加载列表失败', e);
      } finally {
        this.loading = false;
      }
    },
    onCommunityChange(e) {
      const idx = e.detail.value;
      this.filterCommunity = this.communityOptions[idx].value;
      this.loadList();
    },
    onLevelChange(e) {
      const idx = e.detail.value;
      this.filterLevel = this.levelOptions[idx].value;
      this.loadList();
    },
    onStatusChange(e) {
      const idx = e.detail.value;
      this.filterStatus = this.statusOptions[idx].value;
      this.loadList();
    },
    levelName(level) {
      const map = { 1: '光交', 2: '一级分光器', 3: '二级分光器', 4: '光缆成端' };
      return map[level] || '未知';
    },
    statusName(status) {
      const map = { 1: '正常', 2: '故障', 3: '停用', 4: '建设中' };
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
    onDeviceClick(item) {
      this.currentDevice = item;
      this.showDetail = true;
    },
    goAdd() {
      uni.navigateTo({ url: '/pages/add-splitter/add-splitter' });
    },
    async reportFault() {
      uni.showActionSheet({
        itemList: ['无光', '光衰过大', '断纤', '接头损耗'],
        success: (res) => {
          const faultType = res.tapIndex + 1;
          this.doReportFault(faultType);
        },
      });
    },
    async doReportFault(faultType) {
      try {
        await this.$api.splitter.reportFault(this.currentDevice.id, faultType, '');
        uni.showToast({ title: '上报成功', icon: 'success' });
        this.showDetail = false;
        this.loadList();
      } catch (e) {}
    },
    async recoverFault() {
      try {
        await this.$api.splitter.recoverFault(this.currentDevice.id);
        uni.showToast({ title: '恢复成功', icon: 'success' });
        this.showDetail = false;
        this.loadList();
      } catch (e) {}
    },
  },
};
</script>

<style>
.splitter-page {
  min-height: 100vh;
  background: #f5f5f5;
  padding-bottom: 120rpx;
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
.filter-bar {
  background: #fff;
  padding: 0 24rpx 20rpx;
  display: flex;
  gap: 16rpx;
}
.filter-picker {
  flex: 1;
  background: #f5f5f5;
  border-radius: 6rpx;
  padding: 12rpx 16rpx;
  font-size: 24rpx;
}
.picker-text {
  color: #666;
  text-align: center;
}
.stat-bar {
  display: flex;
  padding: 16rpx 24rpx;
  font-size: 24rpx;
  color: #666;
  gap: 24rpx;
  flex-wrap: wrap;
}
.stat-num {
  font-weight: bold;
}
.stat-num.total { color: #1890ff; }
.stat-num.normal { color: #52c41a; }
.stat-num.fault { color: #ff4d4f; }
.stat-num.stopped { color: #fa8c16; }
.stat-num.building { color: #d48806; }

.device-list {
  padding: 0 20rpx;
}
.device-card {
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
.device-name-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.level-dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
}
.level-1 { background: #e74c3c; }
.level-2 { background: #f39c12; }
.level-3 { background: #3498db; }
.level-4 { background: #27ae60; }
.dot-fault {
  border: 4rpx solid #ff4d4f;
}
.device-name {
  font-size: 28rpx;
  font-weight: 500;
  color: #333;
}
.card-info {
  font-size: 24rpx;
  color: #999;
  line-height: 2;
}
.info-item {
  display: flex;
}
.info-label { color: #999; flex-shrink: 0; }
.info-value { color: #666; }
.fault-text { color: #ff4d4f; }

.loading, .empty-tip {
  text-align: center;
  color: #999;
  padding: 80rpx 0;
  font-size: 26rpx;
}

.fab-btn {
  position: fixed;
  right: 40rpx;
  bottom: 160rpx;
  width: 100rpx;
  height: 100rpx;
  background: #07c160;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  box-shadow: 0 4rpx 16rpx rgba(7,193,96,0.4);
  z-index: 100;
}

/* 弹窗 */
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.detail-modal {
  width: 80%;
  background: #fff;
  border-radius: 12rpx;
  overflow: hidden;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 32rpx;
  border-bottom: 1rpx solid #f0f0f0;
}
.detail-title {
  font-size: 30rpx;
  font-weight: 500;
}
.close-btn {
  font-size: 32rpx;
  color: #999;
}
.detail-body {
  padding: 24rpx 32rpx;
}
.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  font-size: 26rpx;
}
.detail-row:last-child {
  border-bottom: none;
}
.d-label { color: #999; }
.d-value { color: #333; max-width: 60%; text-align: right; }
.detail-footer {
  padding: 20rpx 32rpx 24rpx;
  border-top: 1rpx solid #f0f0f0;
}
.btn-fault {
  width: 100%;
  background: #ff4d4f;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
}
</style>
