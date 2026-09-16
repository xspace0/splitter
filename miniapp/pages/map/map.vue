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

    <!-- 地图组件 -->
    <map
      id="splitterMap"
      class="map-container"
      :latitude="centerLat"
      :longitude="centerLng"
      :scale="mapScale"
      :markers="mapMarkers"
      :polyline="mapPolylines"
      :show-location="true"
      :enable-3D="false"
      :show-compass="true"
      :enable-zoom="true"
      :enable-scroll="true"
      :enable-rotate="false"
      @markertap="onMarkerTap"
      @regionchange="onRegionChange"
    ></map>

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
        <view v-if="selectedMarker.splitRatio" class="info-row"><text class="info-label">分路比</text><text class="info-value">{{ selectedMarker.splitRatio }}</text></view>
        <view v-if="selectedMarker.faultType && selectedMarker.status === 2" class="info-row"><text class="info-label">故障类型</text><text class="info-value fault-text">{{ faultTypeName(selectedMarker.faultType) }}</text></view>
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
      centerLng: 116.4074,
      centerLat: 39.9042,
      mapScale: 14,
      mapContext: null,
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
    // map组件需要的markers数组
    mapMarkers() {
      return this.filteredMarkers.map((m, i) => {
        const pos = this.getPosition(m);
        return {
          id: i + 1, // map组件marker id必须是数字
          _itemId: m.id, // 原始id存到自定义字段
          latitude: pos.lat,
          longitude: pos.lng,
          width: 30,
          height: 30,
          callout: {
            content: m.splitterName,
            color: m.status === 2 ? '#ff4d4f' : '#333333',
            fontSize: 10,
            borderRadius: 4,
            bgColor: '#ffffff',
            padding: 4,
            display: 'BYCLICK',
            textAlign: 'center',
          },
          // 用iconPath自定义图标
          iconPath: this.getMarkerIcon(m),
        };
      });
    },
    // map组件需要的polyline数组
    mapPolylines() {
      const lines = [];
      const list = this.filteredMarkers;
      for (const m of list) {
        if (!m.parentId) continue;
        const parent = list.find(p => p.id === m.parentId);
        if (!parent) continue;
        const childPos = this.getPosition(m);
        const parentPos = this.getPosition(parent);
        if (!childPos || !parentPos) continue;

        if (m.splitterLevel === 3 && parent.splitterLevel === 2) {
          lines.push({
            points: [
              { longitude: parentPos.lng, latitude: parentPos.lat },
              { longitude: childPos.lng, latitude: childPos.lat },
            ],
            color: '#1890ff',
            width: 3,
            dottedLine: false,
          });
        } else if (m.splitterLevel === 4 && parent.splitterLevel === 3) {
          lines.push({
            points: [
              { longitude: parentPos.lng, latitude: parentPos.lat },
              { longitude: childPos.lng, latitude: childPos.lat },
            ],
            color: '#52c41a',
            width: 2,
            dottedLine: true,
          });
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
    // 获取map上下文
    this.mapContext = uni.createMapContext('splitterMap', this);
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
        // 如果有数据，调整中心点到第一个设备
        if (this.markers.length > 0) {
          const pos = this.getPosition(this.markers[0]);
          this.centerLng = pos.lng;
          this.centerLat = pos.lat;
        }
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
    getPosition(item) {
      if (item.longitude && item.latitude) {
        return { lng: parseFloat(item.longitude), lat: parseFloat(item.latitude) };
      }
      // 没有经纬度的，用hash模拟分布
      const hash = item.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      return {
        lng: 116.3 + (hash % 100) / 500,
        lat: 39.85 + (hash % 70) / 500,
      };
    },
    // 获取marker图标路径（使用默认标记颜色区分）
    getMarkerIcon(item) {
      // 小程序原生map组件使用系统marker，用颜色区分
      // 这里返回空字符串，使用默认红色标记，通过callout展示名称
      return '';
    },
    onMarkerTap(e) {
      const markerId = e.markerId;
      const marker = this.mapMarkers.find(m => m.id === markerId);
      if (marker) {
        const item = this.filteredMarkers.find(m => m.id === marker._itemId);
        if (item) {
          this.selectedMarker = item;
        }
      }
    },
    onRegionChange(e) {
      // 地图视野变化
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
    getCommunityName(id) {
      return this.communities.find(c => c.id === id)?.communityName || '-';
    },
    locateFault() {
      const fault = this.filteredMarkers.find(m => m.status === 2);
      if (fault) {
        this.selectedMarker = fault;
        const pos = this.getPosition(fault);
        if (this.mapContext) {
          this.mapContext.moveToLocation({
            latitude: pos.lat,
            longitude: pos.lng,
          });
        }
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
  position: relative;
}
.map-container {
  width: 100%;
  height: 100vh;
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
.locate-btn {
  position: absolute;
  top: 140rpx;
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
.info-value { color: #333; max-width: 60%; text-align: right; }
.fault-text { color: #ff4d4f; }
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
.btn-primary {
  width: 100%;
  background: #07c160;
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
  z-index: 5;
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
</style>
