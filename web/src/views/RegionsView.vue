<template>
  <div class="region-container">
    <div class="page-header">
      <h2>行政区划管理</h2>
      <button class="btn btn-primary" @click="handleAddProvince">+ 新增省份</button>
    </div>

    <div class="toolbar">
      <input v-model="search" placeholder="搜索区划名称" @keyup.enter="loadTree" class="search-input" />
      <button class="btn btn-search" @click="loadTree">查询</button>
      <button class="btn" @click="expandAll">全部展开</button>
      <button class="btn" @click="collapseAll">全部折叠</button>
    </div>

    <div class="tree-table">
      <div class="tree-header">
        <div class="col col-name">区划名称</div>
        <div class="col col-level">级别</div>
        <div class="col col-code">区划代码</div>
        <div class="col col-count">下级数量</div>
        <div class="col col-actions">操作</div>
      </div>
      <div class="tree-body">
        <div v-for="row in flatRows" :key="row.id" class="tree-row">
          <div class="col col-name" :style="{ paddingLeft: row.level * 28 + 16 + 'px' }">
            <span v-if="row.hasChildren" class="expand-icon" @click="toggleExpand(row.id)">
              {{ expandedMap[row.id] ? '▾' : '▸' }}
            </span>
            <span v-else class="expand-icon expand-placeholder"></span>
            <span class="node-name">{{ row.regionName }}</span>
          </div>
          <div class="col col-level">
            <span class="role-tag" :class="levelTagClass(row.regionLevel)">{{ levelLabel(row.regionLevel) }}</span>
          </div>
          <div class="col col-code">{{ row.regionCode || '-' }}</div>
          <div class="col col-count">{{ row.childCount }}</div>
          <div class="col col-actions">
            <button v-if="row.levelNum < 3" class="btn-link btn-link-primary" @click="handleAddChild(row)">新增下级</button>
            <button class="btn-link btn-link-default" @click="handleEdit(row)">编辑</button>
            <button class="btn-link btn-link-danger" @click="handleDelete(row)">删除</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <div class="modal-header">
          <h3>{{ isEdit ? '编辑行政区划' : '新增行政区划' }}</h3>
          <button class="btn-close" @click="closeModal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>区划名称 <span class="required">*</span></label>
            <input v-model="form.regionName" class="form-input" placeholder="请输入区划名称" />
          </div>
          <div v-if="!isEdit" class="form-group">
            <label>上级区划</label>
            <input :value="parentName || '无（顶级-省份）'" class="form-input" disabled />
          </div>
          <div v-if="!isEdit" class="form-group">
            <label>级别</label>
            <input :value="levelName(targetLevel)" class="form-input" disabled />
          </div>
          <div class="form-group">
            <label>区划代码</label>
            <input v-model="form.regionCode" class="form-input" placeholder="选填，如 110000" />
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="closeModal">取消</button>
          <button class="btn btn-primary" @click="handleSubmit" :disabled="submitting">{{ submitting ? '提交中...' : '确认' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue';
import { getRegionTree, createRegion, updateRegion, deleteRegion, type RegionTreeItem } from '@/api/region';

interface FlatRow {
  id: string;
  regionName: string;
  regionLevel: string;
  regionCode: string | null;
  level: number;
  levelNum: number;
  hasChildren: boolean;
  childCount: number;
}

const search = ref('');
const loading = ref(false);
const treeData = ref<RegionTreeItem[]>([]);
const expandedMap = reactive<Record<string, boolean>>({});

const showModal = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const form = reactive({ regionName: '', regionCode: '' });
const editingId = ref('');
const parentId = ref<string | null>(null);
const targetLevel = ref(1);
const parentName = ref('');

function levelLabel(level: string) {
  const map: Record<string, string> = { PROVINCE: '省份', CITY: '城市', DISTRICT: '区县' };
  return map[level] || level;
}

function levelName(level: number) {
  const map: Record<number, string> = { 1: '省份（顶级）', 2: '城市', 3: '区县' };
  return map[level] || '未知';
}

function levelTagClass(level: string) {
  const map: Record<string, string> = { PROVINCE: 'role-1', CITY: 'role-2', DISTRICT: 'role-3' };
  return map[level] || '';
}

function levelToNumber(level: string): number {
  const map: Record<string, number> = { PROVINCE: 1, CITY: 2, DISTRICT: 3 };
  return map[level] || 0;
}

// 扁平化树形数据（只展开已展开的节点）
const flatRows = computed((): FlatRow[] => {
  const result: FlatRow[] = [];

  function traverse(items: RegionTreeItem[], level: number) {
    for (const item of items) {
      const hasChildren = item.children && item.children.length > 0;
      result.push({
        id: item.id,
        regionName: item.regionName,
        regionLevel: item.regionLevel,
        regionCode: item.regionCode,
        level,
        levelNum: levelToNumber(item.regionLevel),
        hasChildren: !!hasChildren,
        childCount: hasChildren ? item.children!.length : 0,
      });
      if (hasChildren && expandedMap[item.id]) {
        traverse(item.children!, level + 1);
      }
    }
  }

  traverse(treeData.value, 0);
  return result;
});

async function loadTree() {
  loading.value = true;
  try {
    const res = await getRegionTree();
    treeData.value = res.data;
    // 默认展开第一层
    res.data.forEach(item => {
      expandedMap[item.id] = true;
    });
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}

function toggleExpand(id: string) {
  expandedMap[id] = !expandedMap[id];
}

function expandAll() {
  const setAll = (items: RegionTreeItem[]) => {
    items.forEach(item => {
      expandedMap[item.id] = true;
      if (item.children && item.children.length > 0) {
        setAll(item.children);
      }
    });
  };
  setAll(treeData.value);
}

function collapseAll() {
  Object.keys(expandedMap).forEach(k => {
    expandedMap[k] = false;
  });
}

function handleAddProvince() {
  isEdit.value = false;
  parentId.value = null;
  parentName.value = '';
  targetLevel.value = 1;
  form.regionName = '';
  form.regionCode = '';
  showModal.value = true;
}

function handleAddChild(row: FlatRow) {
  if (row.levelNum >= 3) {
    alert('已是最末级，不能再添加下级');
    return;
  }
  isEdit.value = false;
  parentId.value = row.id;
  parentName.value = row.regionName;
  targetLevel.value = row.levelNum + 1;
  form.regionName = '';
  form.regionCode = '';
  showModal.value = true;
}

function handleEdit(row: FlatRow) {
  isEdit.value = true;
  editingId.value = row.id;
  form.regionName = row.regionName;
  form.regionCode = row.regionCode || '';
  showModal.value = true;
}

function handleDelete(row: FlatRow) {
  if (!confirm(`确定删除「${row.regionName}」吗？`)) return;
  if (row.hasChildren) {
    alert('该区域下有子级区划，请先删除子级');
    return;
  }
  deleteRegion(row.id).then(() => {
    alert('删除成功');
    loadTree();
  }).catch(() => {});
}

function closeModal() {
  showModal.value = false;
}

async function handleSubmit() {
  if (!form.regionName.trim()) {
    alert('请输入区划名称');
    return;
  }
  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateRegion(editingId.value, {
        regionName: form.regionName.trim(),
        regionCode: form.regionCode || undefined,
      });
      alert('修改成功');
    } else {
      await createRegion({
        regionName: form.regionName.trim(),
        regionLevel: targetLevel.value,
        ...(parentId.value ? { parentId: parentId.value } : {}),
        regionCode: form.regionCode || undefined,
      } as any);
      alert('新增成功');
    }
    closeModal();
    loadTree();
  } catch (e: any) {
    // 已弹过toast
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadTree();
});
</script>

<style scoped>
.region-container { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-header h2 { font-size: 18px; margin: 0; }

.toolbar { display: flex; gap: 10px; align-items: center; margin-bottom: 16px; }
.search-input { width: 240px; padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; }
.btn { padding: 6px 16px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; cursor: pointer; background: #fff; color: #333; }
.btn:hover { border-color: #1890ff; color: #1890ff; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:hover { background: #096dd9; color: #fff; }
.btn-search { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-search:hover { background: #096dd9; color: #fff; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

/* 树形表格 */
.tree-table {
  background: #fff;
  border: 1px solid #f0f0f0;
  border-radius: 8px;
  overflow: hidden;
}
.tree-header {
  display: flex;
  background: #fafafa;
  border-bottom: 1px solid #f0f0f0;
  font-weight: 500;
  font-size: 13px;
  color: #666;
}
.col {
  padding: 12px 16px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
}
.col-name { flex: 2; }
.col-level { width: 100px; justify-content: center; }
.col-code { width: 140px; }
.col-count { width: 100px; justify-content: center; }
.col-actions { width: 240px; justify-content: center; gap: 12px; }

.tree-body { max-height: calc(100vh - 280px); overflow-y: auto; }
.tree-row {
  display: flex;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}
.tree-row:hover { background: #fafafa; }

.expand-icon {
  width: 16px;
  text-align: center;
  cursor: pointer;
  color: #999;
  font-size: 12px;
  margin-right: 6px;
  display: inline-block;
}
.expand-placeholder {
  cursor: default;
  visibility: hidden;
  width: 16px;
  display: inline-block;
  margin-right: 6px;
}
.node-name { color: #333; }

.role-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.role-1 { background: #fde8e8; color: #e74c3c; }
.role-2 { background: #fef3e2; color: #f39c12; }
.role-3 { background: #e8f5e9; color: #27ae60; }

.btn-link {
  background: none;
  border: none;
  padding: 0 4px;
  font-size: 13px;
  cursor: pointer;
}
.btn-link-primary { color: #1890ff; }
.btn-link-default { color: #666; }
.btn-link-danger { color: #ff4d4f; }
.btn-link:hover { text-decoration: underline; }

.loading { text-align: center; color: #999; padding: 40px; font-size: 13px; }

.required { color: #ff4d4f; margin-right: 4px; }
.form-input { width: 100%; padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
.form-input:focus { border-color: #1890ff; outline: none; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; width: 480px; max-width: 90vw; overflow: hidden; }
.modal-header { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 16px; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.modal-body { padding: 24px; }
.modal-footer { padding: 12px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 12px; }
</style>
