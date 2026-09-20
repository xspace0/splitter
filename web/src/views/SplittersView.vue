<template>
  <div class="splitter-container">
    <div class="page-header">
      <h2>分光器列表</h2>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-cards">
      <div class="stat-card"><div class="stat-title">设备总数</div><div class="stat-value">{{ stats.total }}</div></div>
      <div class="stat-card"><div class="stat-title">正常</div><div class="stat-value green">{{ stats.normal }}</div></div>
      <div class="stat-card"><div class="stat-title">故障</div><div class="stat-value red">{{ stats.fault }}</div></div>
      <div class="stat-card"><div class="stat-title">停用</div><div class="stat-value orange">{{ stats.stopped }}</div></div>
      <div class="stat-card"><div class="stat-title">建设中</div><div class="stat-value amber">{{ stats.building }}</div></div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <select v-model="filterCommunity" @change="loadList" class="select">
        <option value="">全部社区</option>
        <option v-for="c in communities" :key="c.id" :value="c.id">{{ c.communityName }}</option>
      </select>
      <select v-model="filterLevel" @change="loadList" class="select">
        <option value="">全部级别</option>
        <option :value="1">光交</option>
        <option :value="2">一级分光器</option>
        <option :value="3">二级分光器</option>
        <option :value="4">光缆成端</option>
      </select>
      <select v-model="filterStatus" @change="loadList" class="select">
        <option value="">全部状态</option>
        <option :value="1">正常</option>
        <option :value="2">故障</option>
        <option :value="3">停用</option>
        <option :value="4">建设中</option>
      </select>
      <input v-model="searchKeyword" placeholder="搜索设备名称" @keyup.enter="loadList" class="input" />
      <button class="btn btn-primary btn-sm" @click="loadList">查询</button>
      <button class="btn btn-sm" @click="resetFilters">重置</button>
    </div>

    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="left">
        <button class="btn btn-primary btn-sm" @click="handleCreate">+ 新增分光器</button>
        <button class="btn btn-sm" @click="toggleView">{{ viewMode === 'table' ? '🌳 拓扑树查看' : '📋 表格查看' }}</button>
      </div>
      <div class="right"></div>
    </div>

    <!-- 表格视图 -->
    <template v-if="viewMode === 'table'">
      <table class="data-table">
        <thead>
          <tr>
            <th>设备名称</th><th>所属社区</th><th>设备级别</th><th>父级设备</th>
            <th>分路比</th><th>状态</th><th>故障类型</th><th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in tableData" :key="item.id">
            <td>{{ item.splitterName }}</td>
            <td>{{ getCommunityName(item.communityId) }}</td>
            <td><span class="tag" :class="levelTagClass(item.splitterLevel)">{{ levelMap[item.splitterLevel] }}</span></td>
            <td>{{ getParentName(item) }}</td>
            <td>{{ item.splitRatio || '-' }}</td>
            <td><span class="tag" :class="statusTagClass(item.status)">{{ statusMap[item.status].label }}</span></td>
            <td>{{ item.faultType ? faultTypeMap[item.faultType] || '-' : '-' }}</td>
            <td>
              <button class="btn btn-sm" @click="handleEdit(item)">编辑</button>
              <button v-if="item.status === 2" class="btn btn-sm" style="color:#52c41a;" @click="handleToggleStatus(item, 1)">故障恢复</button>
              <button v-else-if="item.status !== 3" class="btn btn-sm btn-danger" @click="handleDelete(item)">删除</button>
            </td>
          </tr>
          <tr v-if="tableData.length === 0"><td colspan="8" class="empty-row">暂无数据</td></tr>
        </tbody>
      </table>
      <!-- 分页 -->
      <div class="pagination">
        <span>共 {{ total }} 条</span>
        <button class="page-item" :disabled="page === 1" @click="page > 1 && (page--, loadList())">‹</button>
        <span class="page-item active">{{ page }}</span>
        <button class="page-item" :disabled="tableData.length < pageSize" @click="page++, loadList()">›</button>
      </div>
    </template>

    <!-- 树形视图 -->
    <template v-else>
      <div class="tree-section">
        <select v-model="treeCommunityId" @change="loadTree" class="select" style="margin-bottom:12px;">
          <option value="">请选择社区</option>
          <option v-for="c in communities" :key="c.id" :value="c.id">{{ c.communityName }}</option>
        </select>
        <div v-if="treeLoading" class="loading">加载中...</div>
        <div v-else-if="!treeCommunityId" class="empty-tip">请先选择社区</div>
        <div v-else-if="treeData.length === 0" class="empty-tip">暂无数据</div>
        <div v-else class="tree-container">
          <div v-for="node in treeData" :key="node.id">
            <TreeNode :node="node" :level="0" @add-child="handleAddChild" @edit="handleEdit" @toggle-status="handleToggleStatus" @delete="handleDelete" />
          </div>
        </div>
      </div>
    </template>

    <!-- 提示框 -->
    <div class="tip-box info">
      💡 提示：停用社区下的分光器仅可查看，禁止编辑/删除/故障操作；逻辑删除数据（灰色行）仅超级管理员可见，全员禁止写操作。
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑分光器' : '新增分光器' }}</h3>
          <button class="btn-close" @click="showModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>名称 <span class="required">*</span></label>
            <input v-model="formData.splitterName" type="text" placeholder="请输入分光器名称" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>所属社区 <span class="required">*</span></label>
              <select v-model="formData.communityId" :disabled="isEdit" class="form-input">
                <option value="">请选择社区</option>
                <option v-for="c in communities" :key="c.id" :value="c.id">{{ c.communityName }}</option>
              </select>
            </div>
            <div class="form-group">
              <label>级别 <span class="required">*</span></label>
              <select v-model="formData.splitterLevel" :disabled="isEdit" class="form-input">
                <option :value="1">光交</option>
                <option :value="2">一级分光器</option>
                <option :value="3">二级分光器</option>
                <option :value="4">光缆成端</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>父级设备</label>
            <select v-model="formData.parentId" :disabled="!formData.communityId || isEdit" class="form-input">
              <option value="">无（顶级节点）</option>
              <option v-for="p in availableParents" :key="p.id" :value="p.id">{{ p.splitterName }} ({{ levelMap[p.splitterLevel] }})</option>
            </select>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>分光比</label>
              <input v-model="formData.splitRatio" type="text" placeholder="如 1:8" class="form-input" />
            </div>
            <div class="form-group">
              <label>状态</label>
              <select v-model="formData.status" :disabled="isEdit" class="form-input">
                <option :value="1">正常</option>
                <option :value="4">建设中</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label>安装位置</label>
            <input v-model="formData.installLocation" type="text" placeholder="请输入安装位置" class="form-input" />
          </div>
          <div class="form-row">
            <div class="form-group"><label>经度</label><input v-model="formData.longitude" type="text" placeholder="经度" class="form-input" /></div>
            <div class="form-group"><label>纬度</label><input v-model="formData.latitude" type="text" placeholder="纬度" class="form-input" /></div>
          </div>
          <div class="form-group">
            <label>备注</label>
            <textarea v-model="formData.remark" placeholder="请输入备注" class="form-textarea" rows="3"></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showModal = false">取消</button>
          <button class="btn-confirm" @click="handleSubmit" :disabled="submitting">{{ submitting ? '提交中...' : '确定' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h, watch } from 'vue';
import { getCommunities, type CommunityItem } from '@/api/community';
import {
  getSplitterTree, getSplitters, createSplitter, updateSplitter, updateSplitterStatus, deleteSplitter,
  type SplitterTreeItem, type SplitterItem,
} from '@/api/splitter';

const communities = ref<CommunityItem[]>([]);
const tableData = ref<SplitterItem[]>([]);
const treeData = ref<SplitterTreeItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);

const viewMode = ref<'table' | 'tree'>('table');
const searchKeyword = ref('');
const filterCommunity = ref('');
const filterLevel = ref<number | ''>('');
const filterStatus = ref<number | ''>('');
const treeCommunityId = ref('');
const treeLoading = ref(false);

const showModal = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const editingId = ref('');
const formData = ref({
  splitterName: '', communityId: '', splitterLevel: 1, parentId: '',
  splitRatio: '', installLocation: '', longitude: '', latitude: '', status: 1, remark: '',
});

const stats = ref({ total: 0, normal: 0, fault: 0, stopped: 0, building: 0 });
// 父级设备候选（按所选社区 + 上一级别拉取，不受当前分页限制）
const parentOptions = ref<SplitterItem[]>([]);

const statusMap: Record<number, { label: string; tagClass: string }> = {
  1: { label: '正常', tagClass: 'tag-green' },
  2: { label: '故障', tagClass: 'tag-red' },
  3: { label: '停用', tagClass: 'tag-orange' },
  4: { label: '建设中', tagClass: 'tag-amber' },
};

const levelMap: Record<number, string> = { 1: '光交', 2: '一级分光器', 3: '二级分光器', 4: '光缆成端' };
const faultTypeMap: Record<number, string> = { 1: '无光', 2: '光衰过大', 3: '断纤', 4: '接头损耗' };

function levelTagClass(level: number) {
  const map: Record<number, string> = { 1: 'tag-blue', 2: 'tag-blue', 3: 'tag-blue', 4: 'tag-gray' };
  return map[level] || 'tag-gray';
}

function statusTagClass(status: number) {
  return statusMap[status]?.tagClass || 'tag-gray';
}

function getCommunityName(id: string) {
  return communities.value.find((c) => c.id === id)?.communityName || '-';
}

function getParentName(item: SplitterItem | SplitterTreeItem) {
  if (!item.parentId) return '-';
  if (item.parentName) return item.parentName;
  // 拓扑树视图下父节点一定在同一结果集中
  const findInTree = (nodes: SplitterTreeItem[]): string | null => {
    for (const n of nodes) {
      if (n.id === item.parentId) return n.splitterName;
      const found = findInTree(n.children || []);
      if (found) return found;
    }
    return null;
  };
  return findInTree(treeData.value) || '-';
}

const availableParents = computed(() => {
  if (!formData.value.communityId) return [];
  // 从「按社区+父级级别单独拉取」的完整结果集里筛选，
  // 不能只用当前分页的 tableData，否则父级在别的页时用户根本选不到
  return parentOptions.value.filter((s) => {
    if (s.communityId !== formData.value.communityId) return false;
    if (isEdit.value && s.id === editingId.value) return false;
    return s.splitterLevel === formData.value.splitterLevel - 1;
  });
});

/** 拉取指定社区 + 指定级别的全部分光器，供父级下拉使用 */
async function loadParentOptions(communityId: string, level: number) {
  parentOptions.value = [];
  if (!communityId || level < 2) return;
  try {
    const res = await getSplitters({
      page: 1,
      pageSize: 500,
      communityId,
      splitterLevel: level - 1,
    });
    parentOptions.value = res.data.list;
  } catch (e) {
    console.error('加载父级设备失败', e);
  }
}

// 新增场景下切换级别时重新拉取可选父级（一级分光器无需父级）
watch(
  () => [formData.value.communityId, formData.value.splitterLevel] as const,
  ([cid, lvl]) => {
    if (!showModal.value || isEdit.value) return;
    loadParentOptions(cid as string, lvl as number);
  },
);

function toggleView() {
  viewMode.value = viewMode.value === 'table' ? 'tree' : 'table';
  if (viewMode.value === 'tree' && treeCommunityId.value) loadTree();
}

function resetFilters() {
  searchKeyword.value = '';
  filterCommunity.value = '';
  filterLevel.value = '';
  filterStatus.value = '';
  page.value = 1;
  loadList();
}

async function loadCommunities() {
  try {
    const res = await getCommunities({ page: 1, pageSize: 100 });
    communities.value = res.data.list;
  } catch (e) { console.error('加载社区失败', e); }
}

async function loadList() {
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize: pageSize.value };
    if (searchKeyword.value) params.keyword = searchKeyword.value;
    if (filterCommunity.value) params.communityId = filterCommunity.value;
    if (filterLevel.value !== '') params.splitterLevel = filterLevel.value;
    if (filterStatus.value !== '') params.status = filterStatus.value;
    const res = await getSplitters(params);
    tableData.value = res.data.list;
    total.value = res.data.total;
    // 计算统计
    const all = res.data.list;
    stats.value = {
      total: total.value,
      normal: all.filter((s) => s.status === 1).length,
      fault: all.filter((s) => s.status === 2).length,
      stopped: all.filter((s) => s.status === 3).length,
      building: all.filter((s) => s.status === 4).length,
    };
  } catch (e) { console.error('加载列表失败', e); }
}

async function loadTree() {
  if (!treeCommunityId.value) { treeData.value = []; return; }
  treeLoading.value = true;
  try {
    const res = await getSplitterTree(treeCommunityId.value);
    treeData.value = res.data;
  } catch (e) { console.error('加载树失败', e); treeData.value = []; }
  finally { treeLoading.value = false; }
}

function handleCreate() {
  isEdit.value = false;
  editingId.value = '';
  formData.value = {
    splitterName: '', communityId: filterCommunity.value, splitterLevel: 1, parentId: '',
    splitRatio: '', installLocation: '', longitude: '', latitude: '', status: 1, remark: '',
  };
  parentOptions.value = [];
  loadParentOptions(formData.value.communityId, formData.value.splitterLevel);
  showModal.value = true;
}

function handleAddChild(parent: SplitterTreeItem) {
  isEdit.value = false;
  editingId.value = '';
  formData.value = {
    splitterName: '', communityId: parent.communityId, splitterLevel: parent.splitterLevel + 1,
    parentId: parent.id, splitRatio: '', installLocation: '', longitude: '', latitude: '', status: 1, remark: '',
  };
  loadParentOptions(formData.value.communityId, formData.value.splitterLevel);
  showModal.value = true;
}

function handleEdit(item: SplitterItem | SplitterTreeItem) {
  isEdit.value = true;
  editingId.value = item.id;
  formData.value = {
    splitterName: item.splitterName, communityId: item.communityId, splitterLevel: item.splitterLevel,
    parentId: item.parentId || '', splitRatio: item.splitRatio || '', installLocation: item.installLocation || '',
    longitude: item.longitude || '', latitude: item.latitude || '', status: item.status, remark: item.remark || '',
  };
  parentOptions.value = [];
  loadParentOptions(formData.value.communityId, formData.value.splitterLevel);
  showModal.value = true;
}

async function handleToggleStatus(item: SplitterItem | SplitterTreeItem, newStatus: number) {
  try {
    await updateSplitterStatus(item.id, newStatus);
    if (viewMode.value === 'table') loadList();
    else loadTree();
  } catch (e: any) { alert(e.response?.data?.message || '操作失败'); }
}

async function handleDelete(item: SplitterItem | SplitterTreeItem) {
  if (!confirm(`确定删除"${item.splitterName}"吗？`)) return;
  try {
    await deleteSplitter(item.id);
    if (viewMode.value === 'table') loadList();
    else loadTree();
  } catch (e: any) { alert(e.response?.data?.message || '删除失败'); }
}

async function handleSubmit() {
  if (!formData.value.splitterName.trim()) { alert('请输入分光器名称'); return; }
  if (!formData.value.communityId) { alert('请选择社区'); return; }
  submitting.value = true;
  try {
    const payload = {
      splitterName: formData.value.splitterName,
      communityId: formData.value.communityId,
      splitterLevel: formData.value.splitterLevel,
      ...(formData.value.parentId ? { parentId: formData.value.parentId } : {}),
      ...(formData.value.splitRatio ? { splitRatio: formData.value.splitRatio } : {}),
      ...(formData.value.installLocation ? { installLocation: formData.value.installLocation } : {}),
      ...(formData.value.longitude ? { longitude: formData.value.longitude } : {}),
      ...(formData.value.latitude ? { latitude: formData.value.latitude } : {}),
      ...(formData.value.remark ? { remark: formData.value.remark } : {}),
    };
    if (!isEdit.value) {
      await createSplitter({ ...payload, status: formData.value.status });
    } else {
      await updateSplitter(editingId.value, payload);
    }
    showModal.value = false;
    if (viewMode.value === 'table') loadList();
    else loadTree();
  } catch (e: any) { alert(e.response?.data?.message || '操作失败'); }
  finally { submitting.value = false; }
}

// 树节点组件
const TreeNode = {
  name: 'TreeNode',
  props: {
    node: { type: Object as () => SplitterTreeItem, required: true },
    level: { type: Number, default: 0 },
  },
  emits: ['add-child', 'edit', 'toggle-status', 'delete'],
  setup(props: any, { emit }: any) {
    const expanded = ref(true);
    return () =>
      h('div', { class: 'tree-node-wrapper' }, [
        h('div', { class: 'tree-node-content', style: { paddingLeft: props.level * 24 + 'px' } }, [
          props.node.children.length > 0
            ? h('span', { class: 'expand-icon', onClick: () => (expanded.value = !expanded.value) }, expanded.value ? '▼' : '▶')
            : h('span', { class: 'expand-icon placeholder' }, ''),
          h('span', { class: 'level-badge level-' + props.node.splitterLevel }, levelMap[props.node.splitterLevel]),
          h('span', { class: 'node-name' }, props.node.splitterName),
          h('span', { class: 'tag ' + statusTagClass(props.node.status) }, statusMap[props.node.status].label),
          h('div', { class: 'node-actions' }, [
            props.node.splitterLevel < 4 ? h('button', { class: 'btn-link', onClick: () => emit('add-child', props.node) }, '+ 子节点') : null,
            h('button', { class: 'btn-link', onClick: () => emit('edit', props.node) }, '编辑'),
            h('button', { class: 'btn-link btn-danger', onClick: () => emit('delete', props.node) }, '删除'),
          ]),
        ]),
        expanded.value && props.node.children.length > 0
          ? h('div', { class: 'tree-children' },
              props.node.children.map((child: SplitterTreeItem) =>
                h(TreeNode, { key: child.id, node: child, level: props.level + 1,
                  onAddChild: (n: SplitterTreeItem) => emit('add-child', n),
                  onEdit: (n: SplitterTreeItem) => emit('edit', n),
                  onToggleStatus: (n: SplitterTreeItem, s: number) => emit('toggle-status', n, s),
                  onDelete: (n: SplitterTreeItem) => emit('delete', n),
                })
              )
            )
          : null,
      ]);
  },
};

onMounted(() => { loadCommunities(); loadList(); });
</script>

<style scoped>
.splitter-container { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; padding-bottom: 40px; }
.page-header { margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #333; margin: 0; }

.stat-cards { display: flex; gap: 16px; margin-bottom: 20px; }
.stat-card { flex: 1; background: #fff; border: 1px solid #f0f0f0; border-radius: 8px; padding: 20px; }
.stat-title { font-size: 13px; color: #999; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: 600; color: #1890ff; }
.stat-value.green { color: #52c41a; }
.stat-value.red { color: #ff4d4f; }
.stat-value.orange { color: #fa8c16; }
.stat-value.amber { color: #d48806; }

.search-bar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
.select { padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; min-width: 120px; }
.input { padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; width: 180px; }
.btn { padding: 6px 16px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; cursor: pointer; background: #fff; color: #333; }
.btn:hover { border-color: #1890ff; color: #1890ff; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:hover { background: #096dd9; color: #fff; border-color: #096dd9; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-danger { color: #ff4d4f; border-color: #ff4d4f; }
.btn-danger:hover { background: #fff1f0; }

.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.toolbar .left, .toolbar .right { display: flex; gap: 8px; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.data-table th { background: #fafafa; padding: 12px; text-align: left; border-bottom: 1px solid #f0f0f0; color: #666; font-weight: 500; }
.data-table td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
.data-table tr:hover td { background: #f5f5f5; }
.empty-row { text-align: center; color: #999; padding: 40px; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }
.tag-amber { background: #fffbe6; color: #d48806; border-color: #ffe58f; }
.tag-blue { background: #e6f7ff; color: #1890ff; border-color: #91d5ff; }
.tag-gray { background: #fafafa; color: #999; border-color: #d9d9d9; }

.pagination { display: flex; align-items: center; gap: 4px; margin-top: 16px; justify-content: flex-end; }
.pagination span { font-size: 13px; color: #666; margin-right: 8px; }
.page-item { min-width: 32px; height: 32px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.page-item.active { background: #1890ff; color: #fff; border-color: #1890ff; }
.page-item:disabled { opacity: 0.4; cursor: not-allowed; }

.tip-box { margin-top: 12px; padding: 8px 12px; border-radius: 4px; font-size: 12px; }
.tip-box.info { background: #e6f7ff; color: #1890ff; }

.tree-section { background: #fff; border: 1px solid #f0f0f0; border-radius: 8px; padding: 16px; }
.tree-container { }
.tree-node-wrapper { border-bottom: 1px solid #f5f5f5; }
.tree-node-wrapper:last-child { border-bottom: none; }
.tree-node-content { display: flex; align-items: center; gap: 8px; padding: 10px 16px; min-height: 40px; }
.expand-icon { width: 20px; font-size: 10px; color: #999; cursor: pointer; user-select: none; }
.expand-icon.placeholder { visibility: hidden; }
.level-badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; color: #fff; }
.level-1 { background: #e74c3c; }
.level-2 { background: #f39c12; }
.level-3 { background: #3498db; }
.level-4 { background: #27ae60; }
.node-name { flex: 1; font-size: 14px; color: #333; }
.node-actions { display: flex; align-items: center; gap: 8px; }
.btn-link { background: none; border: none; color: #1890ff; font-size: 12px; cursor: pointer; padding: 2px 4px; }
.btn-link:hover { text-decoration: underline; }
.btn-link.btn-danger { color: #ff4d4f; }
.tree-children { background: #fafbfc; }
.loading, .empty-tip { text-align: center; color: #999; padding: 40px; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; width: 520px; max-width: 90%; max-height: 85vh; overflow-y: auto; }
.modal-header { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-size: 16px; margin: 0; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.modal-body { padding: 24px; }
.modal-footer { padding: 12px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 8px; }
.form-group { margin-bottom: 16px; }
.form-row { display: flex; gap: 12px; }
.form-row .form-group { flex: 1; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; }
.required { color: #ff4d4f; }
.form-input, .form-textarea { width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
.form-input:focus, .form-textarea:focus { border-color: #1890ff; outline: none; }
.btn-cancel { padding: 8px 20px; background: #f5f5f5; color: #666; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm { padding: 8px 20px; background: #1890ff; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
