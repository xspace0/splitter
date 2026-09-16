<template>
  <view class="map-page">
    <!-- 筛选条 -->
    <view class="filter-bar">
      <picker :range="communityOptions" range-key="label" @change="onCommunityChange" class="filter-picker">
        <view class="picker-text">{{ selectedCommunityLabel }} ▾</view>
      </picker>
      <picker :range="statusOptions" range-key="label" @change="onStatusChange" class="filter-picker">
        <view class="picker-text">{{ selectedStatusLabel }} ▾</view>
      </picker>
    </view>

    <!-- 地图网格背景 -->
    <view class="map-grid"></view>

    <!-- SVG连接线 -->
    <view class="svg-layer">
      <view v-for="line in connectionLines" :key="line.id" class="connection-line" :style="lineStyle(line)"></view>
    </view>

    <!-- 标记点 -->
    <view v-for="marker in filteredMarkers" :key="marker.id"
      class="map-marker"
      :class="markerClass(marker)"
      :style="markerStyle(marker)"
      @click="selectMarker(marker)">
      <view v-if="marker.splitterLevel === 1" class="marker-triangle red"></view>
      <view v-else-if="marker.splitterLevel <= 3" class="marker-circle" :class="['level-' + marker.splitterLevel, { 'fault': marker.status === 2 }]"></view>
      <view v-else class="marker-ring"></view>
      <text class="marker-label" :class="{ 'fault-label': marker.status === 2 }">{{ marker.splitterName }}{{ marker.status === 2 ? ' ⚠' : '' }}</text>
    </view>

    <!-- 故障定位按钮 -->
    <view class="locate-btn" @click="locateFault">🔴 故障定位</view>

    <!-- 底部信息卡 -->
    <view v-if="selectedMarker" class="bottom-card">
      <view class="card-title">
        <text>{{ selectedMarker.splitterName }}</text>
        <text class="close-btn" @click="selectedMarker = null">✕</text>
      </view>
      <view class="card-content">
        <view class="info-row"><text class="info-label">设备级别</text><text class="info-value">{{ levelName(selectedMarker.splitterLevel) }}</text></view>
        <view class="info-row"><text class="info-label">状态</text><text><text class="tag" :class="statusTagClass(selectedMarker.status)">{{ statusName(selectedMarker.status) }}</text></text></view>
        <view class="info-row"><text class="info-label">所属社区</text><text class="info-value">{{ getCommunityName(selectedMarker.communityId) }}</text></view>
      </view>
      <view class="card-actions">
        <button v-if="selectedMarker.status === 1" class="btn btn-fault" @click="reportFault">故障上报</button>
        <button v-if="selectedMarker.status === 2" class="btn btn-primary" @click="recoverFault">故障恢复</button>
      </view>
    </view>

    <view v-if="filteredMarkers.length === 0 && !loading" class="empty-tip">暂无设备数据</view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      markers: [],
      filterCommunity: '',
      filterStatus: '',
      communities: [],
      communityOptions: [{ value: '', label: '全部社区' }],
      statusOptions: [
        { value: '', label: '全部状态' },
        { value: 1, label: '正常' },
        { value: 2, label: '故障' },
        { value: 3, label: '停用' },
        { value: 4, label: '建设中' },
      ],
      selectedMarker: null,
      loading: false,
    };
  },
  computed: {
    filteredMarkers() {
      return this.markers.filter(m => {
        if (this.filterCommunity && m.communityId !== this.filterCommunity) return false;
        if (this.filterStatus !== '' && String(m.status) !== String(this.filterStatus)) return false;
        return true;
      });
    },
    connectionLines() {
      const lines = [];
      const list = this.filteredMarkers;
      for (const m of list) {
        if (!m.parentId) continue;
        const parent = list.find(p => p.id === m.parentId);
        if (!parent) continue;
        const childPos = this.getPos(m);
        const parentPos = this.getPos(parent);
        if (!childPos || !parentPos) continue;
        // 二级→一级：蓝色实线；成端→二级：绿色虚线
        if (m.splitterLevel === 3 && parent.splitterLevel === 2) {
          lines.push({ id: m.id, x1: childPos.x, y1: childPos.y, x2: parentPos.x, y2: parentPos.y, color: '#1890ff', dashed: false });
        } else if (m.splitterLevel === 4 && parent.splitterLevel === 3) {
          lines.push({ id: m.id, x1: childPos.x, y1: childPos.y, x2: parentPos.x, y2: parentPos.y, color: '#52c41a', dashed: true });
        }
      }
      return lines;
    },
    selectedCommunityLabel() {
      const o = this.communityOptions.find(c => c.value === this.filterCommunity);
      return o ? o.label : '全部社区';
    },
    selectedStatusLabel() {
      const o = this.statusOptions.find(s => String(s.value) === String(this.filterStatus));
      return o ? o.label : '全部状态';
    },
  },
  onShow() {
    this.loadCommunities();
    this.loadMarkers();
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
      } catch (e) { console.error(e); }
    },
    async loadMarkers() {
      this.loading = true;
      try {
        const params = { page: 1, pageSize: 200 };
        if (this.filterCommunity) params.communityId = this.filterCommunity;
        const res = await this.$api.splitter.getSplitters(params);
        this.markers = res.data.list;
      } catch (e) { console.error(e); }
      finally { this.loading = false; }
    },
    onCommunityChange(e) {
      const idx = e.detail.value;
      this.filterCommunity = this.communityOptions[idx].value;
      this.selectedMarker = null;
    },
    onStatusChange(e) {
      const idx = e.detail.value;
      this.filterStatus = this.statusOptions[idx].value;
      this.selectedMarker = null;
    },
    getPos(marker) {
      if (marker.longitude && marker.latitude) {
        const x = ((parseFloat(marker.longitude) + 180) / 360 * 100).toFixed(2);
        const y = ((90 - parseFloat(marker.latitude)) / 180 * 100).toFixed(2);
        return { x: x + '%', y: y + '%' };
      }
      const hash = marker.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      return {
        x: (15 + (hash % 70)) + '%',
        y: (25 + (hash % 50)) + '%',
      };
    },
    lineStyle(line) {
      const dx = this.parsePercent(line.x2) - this.parsePercent(line.x1);
      const dy = this.parsePercent(line.y2) - this.parsePercent(line.y1);
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      return {
        left: line.x1,
        top: line.y1,
        width: length + '%',
        height: line.dashed ? '2rpx' : '3rpx',
        background: line.color,
        transform: `rotate(${angle}deg)`,
        transformOrigin: '0 50%',
        opacity: 0.7,
      };
    },
    parsePercent(str) {
      return parseFloat(str.replace('%', ''));
    },
    markerStyle(marker) {
      const pos = this.getPos(marker);
      return {
        top: pos.y,
        left: pos.x,
      };
    },
    markerClass(marker) {
      return marker.status === 3 ? 'marker-disabled' : '';
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
    getCommunityName(id) {
      return this.communities.find(c => c.id === id)?.communityName || '-';
    },
    selectMarker(marker) {
      this.selectedMarker = marker;
    },
    locateFault() {
      const fault = this.filteredMarkers.find(m => m.status === 2);
      if (fault) {
        this.selectedMarker = fault;
        uni.showToast({ title: '已定位故障设备', icon: 'none' });
      } else {
        uni.showToast({ title: '暂无故障设备', icon: 'none' });
      }
    },
    async reportFault() {
      uni.showActionSheet({
        itemList: ['无光', '光衰过大', '断纤', '接头损耗'],
        success: (res) => {
          this.doReportFault(res.tapIndex + 1);
        },
      });
    },
    async doReportFault(faultType) {
      try {
        await this.$api.splitter.reportFault(this.selectedMarker.id, faultType, '');
        uni.showToast({ title: '上报成功', icon: 'success' });
        this.loadMarkers();
      } catch (e) {}
    },
    async recoverFault() {
      try {
        await this.$api.splitter.recoverFault(this.selectedMarker.id);
        uni.showToast({ title: '恢复成功', icon: 'success' });
        this.loadMarkers();
      } catch (e) {}
    },
  },
};
</script>

<style>
.map-page {
  min-height: 100vh;
  background: #e8f4f8;
  position: relative;
  overflow: hidden;
}
.filter-bar {
  position: absolute;
  top: 20rpx;
  left: 20rpx;
  right: 20rpx;
  z-index: 10;
  display: flex;
  gap: 16rpx;
}
.filter-picker {
  flex: 1;
  background: #fff;
  border-radius: 8rpx;
  padding: 14rpx 20rpx;
  font-size: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}
.picker-text {
  color: #666;
  text-align: center;
  font-size: 24rpx;
}
.map-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: linear-gradient(rgba(24,144,255,0.08) 1rpx, transparent 1rpx), linear-gradient(90deg, rgba(24,144,255,0.08) 1rpx, transparent 1rpx);
  background-size: 60rpx 60rpx;
}
.svg-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: none;
}
.connection-line {
  position: absolute;
  pointer-events: none;
}
.map-marker {
  position: absolute;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  transform: translate(-50%, -50%);
}
.map-marker.marker-disabled {
  opacity: 0.4;
}
.marker-triangle {
  width: 0;
  height: 0;
  border-left: 20rpx solid transparent;
  border-right: 20rpx solid transparent;
  border-bottom: 32rpx solid #e74c3c;
}
.marker-circle {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  border: 4rpx solid transparent;
}
.marker-circle.level-2 { background: #f39c12; border-color: #e67e22; }
.marker-circle.level-3 { background: #3498db; border-color: #2980b9; }
.marker-circle.fault {
  border-color: #ff4d4f;
  border-width: 6rpx;
}
.marker-ring {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  border: 6rpx solid #27ae60;
  background: transparent;
}
.marker-label {
  font-size: 20rpx;
  white-space: nowrap;
  margin-top: 4rpx;
  background: rgba(255,255,255,0.85);
  padding: 2rpx 8rpx;
  border-radius: 4rpx;
  color: #333;
}
.fault-label {
  color: #ff4d4f;
  font-weight: bold;
}
.locate-btn {
  position: absolute;
  top: 120rpx;
  right: 20rpx;
  z-index: 10;
  background: #fff;
  padding: 16rpx 20rpx;
  border-radius: 40rpx;
  font-size: 24rpx;
  color: #ff4d4f;
  box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.1);
}
.bottom-card {
  position: absolute;
  left: 20rpx;
  right: 20rpx;
  bottom: 40rpx;
  background: #fff;
  border-radius: 12rpx;
  z-index: 20;
  box-shadow: 0 4rpx 20rpx rgba(0,0,0,0.15);
}
.card-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24rpx 28rpx;
  border-bottom: 1rpx solid #f0f0f0;
  font-size: 28rpx;
  font-weight: 500;
}
.close-btn {
  font-size: 32rpx;
  color: #999;
}
.card-content {
  padding: 16rpx 28rpx;
}
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12rpx 0;
  font-size: 26rpx;
}
.info-label { color: #999; }
.info-value { color: #333; }
.card-actions {
  padding: 16rpx 28rpx 24rpx;
}
.btn-fault {
  width: 100%;
  background: #ff4d4f;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
}
.empty-tip {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #999;
  font-size: 26rpx;
}
</style>
