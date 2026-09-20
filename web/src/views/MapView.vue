<template>
  <div class="map-page">
    <div class="map-layout">
      <!-- 左侧筛选面板 -->
      <div class="filter-panel">
        <h3>地图筛选</h3>
        <div class="form-group">
          <label>社区筛选</label>
          <select v-model="filterCommunity" @change="loadMarkers" class="select">
            <option value="">全部社区</option>
            <option v-for="c in communities" :key="c.id" :value="c.id">{{ c.communityName }}</option>
          </select>
        </div>
        <div class="form-group">
          <label>设备级别</label>
          <div class="checkbox-group">
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[1]" @change="renderMarkers" /> 光交</label>
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[2]" @change="renderMarkers" /> 一级</label>
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[3]" @change="renderMarkers" /> 二级</label>
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[4]" @change="renderMarkers" /> 成端</label>
          </div>
        </div>
        <div class="form-group">
          <label>状态筛选</label>
          <div class="checkbox-group">
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[1]" @change="renderMarkers" /> 正常</label>
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[2]" @change="renderMarkers" /> 故障</label>
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[3]" @change="renderMarkers" /> 停用</label>
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[4]" @change="renderMarkers" /> 建设中</label>
          </div>
        </div>
        <div class="divider"></div>
        <div class="stat-list">
          <div>正常设备：<span class="tag tag-green">{{ counts.normal }}</span></div>
          <div>故障设备：<span class="tag tag-red">{{ counts.fault }}</span></div>
          <div>停用设备：<span class="tag tag-orange">{{ counts.stopped }}</span></div>
          <div>建设中设备：<span class="tag tag-amber">{{ counts.building }}</span></div>
        </div>
        <div class="divider"></div>
        <div class="legend">
          <div class="legend-title">标记图例</div>
          <div class="legend-item"><span class="legend-marker triangle red"></span> 红色三角 = 光交</div>
          <div class="legend-item"><span class="legend-marker circle orange"></span> 橙色圆点 = 一级分光器</div>
          <div class="legend-item"><span class="legend-marker circle blue"></span> 蓝色圆点 = 二级分光器</div>
          <div class="legend-item"><span class="legend-marker ring green"></span> 绿色圆环 = 光缆成端</div>
          <div class="legend-sub">故障：红色边框</div>
          <div class="legend-sub">停用：半透明</div>
          <div class="legend-sub">建设中：黄色虚线边框</div>
        </div>
      </div>

      <!-- 地图容器 -->
      <div class="map-area">
        <div id="amap-container" class="amap-container"></div>

        <!-- 浮动工具按钮 -->
        <div class="float-tools">
          <div class="tool-btn" title="定位到我的位置" @click="locateMe">📍</div>
          <div class="tool-btn" title="快速定位故障设备" @click="locateFault">🔴</div>
        </div>

        <!-- 信息弹窗 -->
        <div v-if="selectedMarker" class="map-popup">
          <div class="popup-header">
            <h4>分光器信息</h4>
            <span class="popup-close" @click="selectedMarker = null">✕</span>
          </div>
          <div class="popup-name">{{ selectedMarker.splitterName }}</div>
          <div class="popup-row"><span>所属社区</span><span>{{ getCommunityName(selectedMarker.communityId) }}</span></div>
          <div class="popup-row"><span>设备级别</span><span>{{ levelName(selectedMarker.splitterLevel) }}</span></div>
          <div class="popup-row"><span>分路比</span><span>{{ selectedMarker.splitRatio || '-' }}</span></div>
          <div class="popup-row">
            <span>状态</span>
            <span><span class="tag" :class="statusTagClass(selectedMarker.status)">{{ statusName(selectedMarker.status) }}</span></span>
          </div>
          <div class="popup-row" v-if="selectedMarker.faultType"><span>故障类型</span><span>{{ faultTypeName(selectedMarker.faultType) }}</span></div>
          <div class="popup-row"><span>安装位置</span><span>{{ selectedMarker.installLocation || '-' }}</span></div>
          <div class="popup-row" v-if="selectedMarker.parentId"><span>父级设备</span><span>{{ getParentName(selectedMarker.parentId) }}</span></div>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredMarkers.length === 0 && !loading && mapReady" class="map-empty">
          <p style="font-size:14px; color:#999;">暂无设备数据</p>
          <p style="font-size:12px; color:#bbb; margin-top:4px;">请调整筛选条件或添加分光器设备</p>
        </div>

        <!-- 地图加载中 -->
        <div v-if="!mapReady" class="map-loading">
          <p style="font-size:14px; color:#999;">地图加载中...</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import type { CommunityItem } from '@/api/community';
import { loadCommunityOptions } from '@/utils/communityOptions';
import { getSplitters, type SplitterItem } from '@/api/splitter';

const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '';
const AMAP_SECURITY = import.meta.env.VITE_AMAP_SECURITY || '';

const communities = ref<CommunityItem[]>([]);
const allMarkers = ref<SplitterItem[]>([]);
const loading = ref(false);
const mapReady = ref(false);
const selectedMarker = ref<SplitterItem | null>(null);

const filterCommunity = ref('');
const levelFilter = reactive<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true });
const statusFilter = reactive<Record<number, boolean>>({ 1: true, 2: true, 3: false, 4: true });

const counts = reactive({ normal: 0, fault: 0, stopped: 0, building: 0 });

let map: any = null;
let markerInstances: any[] = [];
let polylineInstances: any[] = [];

const statusNames: Record<number, string> = { 1: '正常', 2: '故障', 3: '停用', 4: '建设中' };
const levelNames: Record<number, string> = { 1: '光交', 2: '一级分光器', 3: '二级分光器', 4: '光缆成端' };
const faultTypeNames: Record<number, string> = { 1: '无光', 2: '光衰过大', 3: '断纤', 4: '接头损耗' };

function statusName(s: number) { return statusNames[s] || '未知'; }
function levelName(l: number) { return levelNames[l] || '未知'; }
function faultTypeName(f: number) { return faultTypeNames[f] || '-'; }

function statusTagClass(s: number) {
  const map: Record<number, string> = { 1: 'tag-green', 2: 'tag-red', 3: 'tag-orange', 4: 'tag-amber' };
  return map[s] || 'tag-gray';
}

function getCommunityName(id: string) { return communities.value.find(c => c.id === id)?.communityName || '-'; }
function getParentName(parentId: string) { return allMarkers.value.find(m => m.id === parentId)?.splitterName || '-'; }

const filteredMarkers = computed(() => {
  return allMarkers.value.filter(m => {
    if (filterCommunity.value && m.communityId !== filterCommunity.value) return false;
    if (!levelFilter[m.splitterLevel]) return false;
    if (!statusFilter[m.status]) return false;
    return true;
  });
});

// 加载高德地图JS API
function loadAMap(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).AMap) {
      resolve((window as any).AMap);
      return;
    }
    // 设置安全密钥
    (window as any)._AMapSecurityConfig = {
      securityJsCode: AMAP_SECURITY || 'your_security_code',
    };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY || 'demo'}&plugin=AMap.Scale,AMap.ToolBar`;
    script.onload = () => resolve((window as any).AMap);
    script.onerror = () => reject(new Error('高德地图加载失败'));
    document.head.appendChild(script);
  });
}

async function initMap() {
  try {
    const AMap = await loadAMap();
    map = new AMap.Map('amap-container', {
      zoom: 13,
      center: [116.4074, 39.9042], // 默认北京
      mapStyle: 'amap://styles/normal',
    });
    map.addControl(new AMap.Scale());
    map.addControl(new AMap.ToolBar({ position: 'RB' }));
    mapReady.value = true;
  } catch (e) {
    console.error('地图初始化失败', e);
    // 降级：标记为已就绪但使用模拟数据
    mapReady.value = true;
  }
}

// 渲染标记点
function renderMarkers() {
  if (!map || !mapReady.value) return;

  // 清除旧标记
  markerInstances.forEach(m => map.remove(m));
  polylineInstances.forEach(p => map.remove(p));
  markerInstances = [];
  polylineInstances = [];

  const AMap = (window as any).AMap;
  if (!AMap) return;

  const list = filteredMarkers.value;

  // 创建标记点
  for (const item of list) {
    let position: [number, number];
    if (item.longitude && item.latitude) {
      position = [parseFloat(item.longitude), parseFloat(item.latitude)];
    } else {
      // 没有经纬度的，按社区中心随机分布
      const hash = item.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
      const baseLng = 116.3 + (hash % 100) / 500;
      const baseLat = 39.85 + (hash % 70) / 500;
      position = [baseLng, baseLat];
    }

    const marker = new AMap.Marker({
      position,
      content: createMarkerContent(item),
      offset: new AMap.Pixel(-15, -30),
      anchor: 'bottom-center',
      extData: item,
    });

    marker.on('click', () => {
      selectedMarker.value = item;
    });

    marker.setMap(map);
    markerInstances.push(marker);
  }

  // 创建连接线（二级→一级，成端→二级）
  for (const m of list) {
    if (!m.parentId) continue;
    const parent = list.find(p => p.id === m.parentId);
    if (!parent) continue;

    const childPos = getMarkerPosition(m);
    const parentPos = getMarkerPosition(parent);
    if (!childPos || !parentPos) continue;

    const isDashed = m.splitterLevel === 4; // 成端用虚线
    const color = m.splitterLevel === 3 ? '#1890ff' : '#52c41a';
    const weight = m.splitterLevel === 3 ? 3 : 2;

    const polyline = new AMap.Polyline({
      path: [parentPos, childPos],
      strokeColor: color,
      strokeWeight: weight,
      strokeOpacity: 0.7,
      strokeStyle: isDashed ? 'dashed' : 'solid',
      strokeDasharray: isDashed ? [6, 4] : undefined,
    });

    polyline.setMap(map);
    polylineInstances.push(polyline);
  }

  // 自适应视野
  if (markerInstances.length > 0) {
    map.setFitView(markerInstances, false, [60, 60, 60, 60]);
  }
}

function getMarkerPosition(item: SplitterItem): [number, number] | null {
  if (item.longitude && item.latitude) {
    return [parseFloat(item.longitude), parseFloat(item.latitude)];
  }
  const hash = item.id.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
  const baseLng = 116.3 + (hash % 100) / 500;
  const baseLat = 39.85 + (hash % 70) / 500;
  return [baseLng, baseLat];
}

// 自定义标记点DOM
function createMarkerContent(item: SplitterItem): string {
  const isFault = item.status === 2;
  const isStopped = item.status === 3;
  const opacity = isStopped ? '0.4' : '1';

  if (item.splitterLevel === 1) {
    // 光交：三角形
    const borderColor = isFault ? '#ff4d4f' : '#c0392b';
    return `<div style="opacity:${opacity}; display:flex; flex-direction:column; align-items:center;">
      <svg width="32" height="32"><polygon points="16,4 28,26 4,26" fill="#e74c3c" stroke="${borderColor}" stroke-width="${isFault ? 3 : 2}"/></svg>
      <div style="font-size:11px; white-space:nowrap; margin-top:2px; background:rgba(255,255,255,0.85); padding:0 4px; border-radius:2px; color:${isFault ? '#ff4d4f' : '#333'}">
        ${item.splitterName}${isFault ? ' ⚠' : ''}
      </div>
    </div>`;
  } else if (item.splitterLevel <= 3) {
    // 一级/二级：圆
    const fill = item.splitterLevel === 2 ? '#f39c12' : '#3498db';
    const stroke = isFault ? '#ff4d4f' : (item.splitterLevel === 2 ? '#e67e22' : '#2980b9');
    const size = isFault ? 26 : 22;
    return `<div style="opacity:${opacity}; display:flex; flex-direction:column; align-items:center;">
      <div style="width:${size}px; height:${size}px; border-radius:50%; background:${fill}; border:${isFault ? 3 : 2}px solid ${stroke};"></div>
      <div style="font-size:11px; white-space:nowrap; margin-top:2px; background:rgba(255,255,255,0.85); padding:0 4px; border-radius:2px; color:${isFault ? '#ff4d4f' : '#333'}">
        ${item.splitterName}${isFault ? ' ⚠' : ''}
      </div>
    </div>`;
  } else {
    // 成端：圆环
    return `<div style="opacity:${opacity}; display:flex; flex-direction:column; align-items:center;">
      <div style="width:20px; height:20px; border-radius:50%; border:3px solid #27ae60; background:transparent;"></div>
      <div style="font-size:11px; white-space:nowrap; margin-top:2px; background:rgba(255,255,255,0.85); padding:0 4px; border-radius:2px; color:#333">
        ${item.splitterName}
      </div>
    </div>`;
  }
}

async function loadCommunities() {
  // 地图页全部角色均可访问，必须按角色选择下拉数据来源：
  // 查看者/操作员调用社区管理接口 /communities 会得到 403，导致下拉框空白
  communities.value = (await loadCommunityOptions()) as unknown as CommunityItem[];
}

async function loadMarkers() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: 1, pageSize: 200 };
    if (filterCommunity.value) params.communityId = filterCommunity.value;
    const res = await getSplitters(params);
    allMarkers.value = res.data.list;

    counts.normal = allMarkers.value.filter(m => m.status === 1).length;
    counts.fault = allMarkers.value.filter(m => m.status === 2).length;
    counts.stopped = allMarkers.value.filter(m => m.status === 3).length;
    counts.building = allMarkers.value.filter(m => m.status === 4).length;

    nextTick(() => renderMarkers());
  } catch (e) { console.error('加载设备失败', e); allMarkers.value = []; }
  finally { loading.value = false; }
}

function locateMe() {
  if (!map) return;
  const AMap = (window as any).AMap;
  if (!AMap) return;
  map.plugin('AMap.Geolocation', () => {
    const geolocation = new AMap.Geolocation({
      enableHighAccuracy: true,
      timeout: 10000,
    });
    geolocation.getCurrentPosition((status: string, result: any) => {
      if (status === 'complete') {
        map.setCenter([result.position.lng, result.position.lat]);
        map.setZoom(15);
      } else {
        // 定位失败用浏览器定位
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              map.setCenter([pos.coords.longitude, pos.coords.latitude]);
              map.setZoom(15);
            },
            () => alert('定位失败，请检查浏览器定位权限'),
          );
        }
      }
    });
  });
}

function locateFault() {
  const fault = allMarkers.value.find(m => m.status === 2);
  if (fault) {
    selectedMarker.value = fault;
    const pos = getMarkerPosition(fault);
    if (pos && map) {
      map.setCenter(pos);
      map.setZoom(16);
    }
  } else {
    alert('暂无故障设备');
  }
}

onMounted(() => {
  loadCommunities();
  initMap().then(() => loadMarkers());
});

onUnmounted(() => {
  if (map) {
    map.destroy();
    map = null;
  }
  markerInstances = [];
  polylineInstances = [];
});
</script>

<style scoped>
.map-page { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; }

.map-layout { display: flex; height: calc(100vh - 120px); gap: 0; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #f0f0f0; }

/* 左侧筛选 */
.filter-panel { width: 260px; border-right: 1px solid #f0f0f0; padding: 16px; overflow-y: auto; flex-shrink: 0; }
.filter-panel h3 { font-size: 14px; margin: 0 0 16px; color: #333; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; }
.select { width: 100%; padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
.checkbox-group { display: flex; flex-direction: column; gap: 4px; }
.checkbox-item { display: flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; }
.checkbox-item input { cursor: pointer; }

.divider { height: 1px; background: #e8e8e8; margin: 16px 0; }
.stat-list { font-size: 13px; line-height: 2; }
.legend { font-size: 12px; color: #999; line-height: 1.8; }
.legend-title { font-weight: 500; color: #666; margin-bottom: 4px; }
.legend-item { display: flex; align-items: center; gap: 6px; }
.legend-marker { display: inline-block; width: 14px; height: 14px; }
.legend-marker.triangle { width: 0; height: 0; border-left: 7px solid transparent; border-right: 7px solid transparent; border-bottom: 12px solid #e74c3c; }
.legend-marker.circle { border-radius: 50%; }
.legend-marker.ring { border-radius: 50%; background: none; border: 3px solid #27ae60; }
.legend-marker.red { background: #e74c3c; }
.legend-marker.orange { background: #f39c12; }
.legend-marker.blue { background: #3498db; }
.legend-marker.green { border: 3px solid #27ae60; }
.legend-sub { padding-left: 20px; }

/* 地图区域 */
.map-area { flex: 1; position: relative; overflow: hidden; }
.amap-container { width: 100%; height: 100%; }

.map-popup { position: absolute; top: 12px; right: 60px; width: 240px; background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); padding: 16px; z-index: 10; }
.popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.popup-header h4 { margin: 0; font-size: 14px; }
.popup-close { font-size: 18px; color: #999; cursor: pointer; line-height: 1; }
.popup-name { font-weight: 500; margin-bottom: 8px; color: #333; font-size: 14px; }
.popup-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.popup-row span:first-child { color: #999; }
.popup-row span:last-child { color: #333; }

.float-tools { position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 5; }
.tool-btn { width: 36px; height: 36px; background: #fff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; }
.tool-btn:hover { background: #f5f5f5; }

.map-empty, .map-loading { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; background: #e8f4f8; pointer-events: none; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }
.tag-amber { background: #fffbe6; color: #d48806; border-color: #ffe58f; }
.tag-gray { background: #fafafa; color: #999; border-color: #d9d9d9; }
</style>
