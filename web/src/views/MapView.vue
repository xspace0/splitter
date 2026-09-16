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
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[1]" /> 光交</label>
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[2]" /> 一级</label>
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[3]" /> 二级</label>
            <label class="checkbox-item"><input type="checkbox" v-model="levelFilter[4]" /> 成端</label>
          </div>
        </div>
        <div class="form-group">
          <label>状态筛选</label>
          <div class="checkbox-group">
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[1]" /> 正常</label>
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[2]" /> 故障</label>
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[3]" /> 停用</label>
            <label class="checkbox-item"><input type="checkbox" v-model="statusFilter[4]" /> 建设中</label>
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
          <div class="legend-sub">故障：红色边框闪烁</div>
          <div class="legend-sub">停用：半透明</div>
          <div class="legend-sub">建设中：黄色虚线边框</div>
        </div>
      </div>

      <!-- 地图区域 -->
      <div class="map-area">
        <div class="map-grid"></div>

        <!-- SVG连接线层 -->
        <svg class="connection-layer" v-if="filteredMarkers.length > 0">
          <line v-for="line in connectionLines" :key="line.id"
            :x1="line.x1" :y1="line.y1" :x2="line.x2" :y2="line.y2"
            :stroke="line.color" :stroke-width="line.width" :stroke-dasharray="line.dash || ''" />
        </svg>

        <!-- 标记点 -->
        <div v-for="marker in filteredMarkers" :key="marker.id"
          class="map-marker"
          :class="markerClass(marker)"
          :style="markerStyle(marker)"
          @click="selectMarker(marker)">
          <!-- 光交：三角形 -->
          <svg v-if="marker.splitterLevel === 1" width="32" height="32">
            <polygon points="16,4 28,26 4,26" :fill="levelColor(marker.splitterLevel)" stroke="#c0392b" stroke-width="2" />
          </svg>
          <!-- 一级/二级：实心圆 -->
          <svg v-else-if="marker.splitterLevel <= 3" :width="marker.status === 2 ? 30 : 26" :height="marker.status === 2 ? 30 : 26">
            <circle :cx="marker.status === 2 ? 15 : 13" :cy="marker.status === 2 ? 15 : 13" r="10"
              :fill="levelColor(marker.splitterLevel)" :stroke="marker.status === 2 ? '#ff4d4f' : strokeColor(marker.splitterLevel)"
              :stroke-width="marker.status === 2 ? 3 : 2" />
            <animate v-if="marker.status === 2" attributeName="stroke-width" values="2;5;2" dur="1s" repeatCount="indefinite" />
          </svg>
          <!-- 光缆成端：空心圆环 -->
          <svg v-else width="26" height="26">
            <circle cx="13" cy="13" r="9" fill="none" stroke="#27ae60" stroke-width="3" />
          </svg>
          <span class="marker-label" :class="{ 'marker-label-fault': marker.status === 2 }">
            {{ marker.splitterName }}{{ marker.status === 2 ? ' ⚠' : '' }}
          </span>
        </div>

        <!-- 弹窗 -->
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

        <!-- 浮动工具按钮 -->
        <div class="float-tools">
          <div class="tool-btn" title="定位到我的位置">📍</div>
          <div class="tool-btn" title="快速定位故障设备" @click="locateFault">🔴</div>
        </div>

        <!-- 空状态 -->
        <div v-if="filteredMarkers.length === 0 && !loading" class="map-empty">
          <p style="font-size:14px; color:#999;">暂无设备数据</p>
          <p style="font-size:12px; color:#bbb; margin-top:4px;">请调整筛选条件或添加分光器设备</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { getCommunities, type CommunityItem } from '@/api/community';
import { getSplitters, getSplitterTree, type SplitterItem, type SplitterTreeItem } from '@/api/splitter';

const communities = ref<CommunityItem[]>([]);
const allMarkers = ref<SplitterItem[]>([]);
const treeData = ref<SplitterTreeItem[]>([]);
const loading = ref(false);
const selectedMarker = ref<SplitterItem | null>(null);

const filterCommunity = ref('');
const levelFilter = reactive<Record<number, boolean>>({ 1: true, 2: true, 3: true, 4: true });
const statusFilter = reactive<Record<number, boolean>>({ 1: true, 2: true, 3: false, 4: true });

const counts = reactive({ normal: 0, fault: 0, stopped: 0, building: 0 });

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

function levelColor(level: number) {
  const map: Record<number, string> = { 1: '#e74c3c', 2: '#f39c12', 3: '#3498db', 4: 'none' };
  return map[level] || '#999';
}

function strokeColor(level: number) {
  const map: Record<number, string> = { 1: '#c0392b', 2: '#e67e22', 3: '#2980b9' };
  return map[level] || '#999';
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

const connectionLines = computed(() => {
  const lines: { id: string; x1: string; y1: string; x2: string; y2: string; color: string; width: number; dash?: string }[] = [];
  const markers = filteredMarkers.value;
  for (const m of markers) {
    if (!m.parentId) continue;
    const parent = markers.find(p => p.id === m.parentId);
    if (!parent) continue;
    const childPos = getMarkerPosition(m);
    const parentPos = getMarkerPosition(parent);
    if (!childPos || !parentPos) continue;

    // 二级→一级：实线，成端→二级：虚线
    if (m.splitterLevel === 3 && parent.splitterLevel === 2) {
      lines.push({ id: `${m.id}-parent`, x1: childPos.x, y1: childPos.y, x2: parentPos.x, y2: parentPos.y, color: '#1890ff', width: 2 });
    } else if (m.splitterLevel === 4 && parent.splitterLevel === 3) {
      lines.push({ id: `${m.id}-parent`, x1: childPos.x, y1: childPos.y, x2: parentPos.x, y2: parentPos.y, color: '#52c41a', width: 1.5, dash: '5,3' });
    }
  }
  return lines;
});

function getMarkerPosition(marker: SplitterItem): { x: string; y: string } | null {
  if (marker.longitude && marker.latitude) {
    const x = ((parseFloat(marker.longitude) + 180) / 360 * 100).toFixed(2);
    const y = ((90 - parseFloat(marker.latitude)) / 180 * 100).toFixed(2);
    return { x: x + '%', y: y + '%' };
  }
  // 没有经纬度时用hash分布
  const hash = marker.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    x: (15 + (hash % 70)) + '%',
    y: (25 + (hash % 50)) + '%',
  };
}

function markerClass(marker: SplitterItem) {
  const classes: string[] = [];
  if (marker.status === 3) classes.push('marker-disabled');
  if (marker.status === 4) classes.push('marker-building');
  return classes.join(' ');
}

function markerStyle(marker: SplitterItem) {
  const pos = getMarkerPosition(marker);
  if (!pos) return {};
  return {
    top: pos.y,
    left: pos.x,
    transform: 'translate(-50%, -50%)',
  };
}

function selectMarker(marker: SplitterItem) { selectedMarker.value = marker; }

function locateFault() {
  const fault = allMarkers.value.find(m => m.status === 2);
  if (fault) { selectedMarker.value = fault; }
  else { alert('暂无故障设备'); }
}

async function loadCommunities() {
  try {
    const res = await getCommunities({ page: 1, pageSize: 100 });
    communities.value = res.data.list;
  } catch (e) { console.error('加载社区失败', e); }
}

async function loadMarkers() {
  loading.value = true;
  try {
    const params: Record<string, unknown> = { page: 1, pageSize: 200 };
    if (filterCommunity.value) params.communityId = filterCommunity.value;
    const res = await getSplitters(params);
    allMarkers.value = res.data.list;

    // 计算统计
    counts.normal = allMarkers.value.filter(m => m.status === 1).length;
    counts.fault = allMarkers.value.filter(m => m.status === 2).length;
    counts.stopped = allMarkers.value.filter(m => m.status === 3).length;
    counts.building = allMarkers.value.filter(m => m.status === 4).length;

    // 加载树结构用于连接线
    if (filterCommunity.value) {
      try {
        const treeRes = await getSplitterTree(filterCommunity.value);
        treeData.value = treeRes.data;
      } catch { treeData.value = []; }
    }
  } catch (e) { console.error('加载设备失败', e); allMarkers.value = []; }
  finally { loading.value = false; }
}

onMounted(() => { loadCommunities(); loadMarkers(); });
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
.map-area { flex: 1; position: relative; overflow: hidden; background: linear-gradient(135deg, #e8f4f8 0%, #d1e8e5 100%); }
.map-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(24,144,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(24,144,255,0.08) 1px, transparent 1px); background-size: 40px 40px; }

.connection-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1; }

.map-marker { position: absolute; display: flex; flex-direction: column; align-items: center; cursor: pointer; z-index: 3; }
.map-marker.marker-disabled { opacity: 0.4; }
.map-marker.marker-building svg { filter: drop-shadow(0 0 3px #d48806); }
.marker-label { font-size: 11px; white-space: nowrap; margin-top: 2px; background: rgba(255,255,255,0.8); padding: 0 4px; border-radius: 2px; }
.marker-label-fault { color: #ff4d4f; font-weight: 500; background: rgba(255,255,255,0.9); }

/* 弹窗 */
.map-popup { position: absolute; top: 12px; right: 60px; width: 220px; background: #fff; border-radius: 8px; box-shadow: 0 2px 12px rgba(0,0,0,0.15); padding: 16px; z-index: 10; }
.popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
.popup-header h4 { margin: 0; font-size: 14px; }
.popup-close { font-size: 18px; color: #999; cursor: pointer; line-height: 1; }
.popup-name { font-weight: 500; margin-bottom: 8px; color: #333; font-size: 14px; }
.popup-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
.popup-row span:first-child { color: #999; }
.popup-row span:last-child { color: #333; }

/* 浮动工具 */
.float-tools { position: absolute; top: 12px; right: 12px; display: flex; flex-direction: column; gap: 8px; z-index: 5; }
.tool-btn { width: 36px; height: 36px; background: #fff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: flex; align-items: center; justify-content: center; font-size: 16px; cursor: pointer; }
.tool-btn:hover { background: #f5f5f5; }

.map-empty { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 2; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }
.tag-amber { background: #fffbe6; color: #d48806; border-color: #ffe58f; }
.tag-gray { background: #fafafa; color: #999; border-color: #d9d9d9; }
</style>
