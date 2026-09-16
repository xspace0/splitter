<template>
  <div class="splitter-container">
    <div class="page-header">
      <h2>分光器管理</h2>
      <button class="btn-primary" @click="handleCreateRoot">+ 新增光交</button>
    </div>

    <div class="toolbar">
      <select v-model="selectedCommunityId" @change="loadTree" class="community-select">
        <option value="">请选择社区</option>
        <option v-for="c in communities" :key="c.id" :value="c.id">{{ c.communityName }}</option>
      </select>
      <input v-model="searchKeyword" placeholder="搜索分光器名称" @keyup.enter="filterTree" class="search-input" />
      <select v-model="filterStatus" @change="filterTree" class="filter-select">
        <option value="">全部状态</option>
        <option :value="1">正常</option>
        <option :value="2">故障</option>
        <option :value="3">停用</option>
        <option :value="4">建设中</option>
      </select>
    </div>

    <div v-if="treeLoading" class="loading">加载中...</div>
    <div v-else-if="!selectedCommunityId" class="empty-tip">请先选择社区</div>
    <div v-else-if="filteredTree.length === 0" class="empty-tip">暂无数据</div>
    <div v-else class="tree-container">
      <div v-for="node in filteredTree" :key="node.id" class="tree-node">
        <TreeNode :node="node" :level="0" @add-child="handleAddChild" @edit="handleEdit" @toggle-status="handleToggleStatus" @delete="handleDelete" />
      </div>
    </div>

    <!-- 新增/编辑弹窗 -->
    <div v-if="showModal" class="modal-overlay" @click.self="showModal = false">
      <div class="modal">
        <h3>{{ isEdit ? '编辑分光器' : '新增分光器' }}</h3>
        <div class="form-group">
          <label>名称 <span class="required">*</span></label>
          <input v-model="formData.splitterName" type="text" placeholder="请输入分光器名称" class="form-input" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>级别</label>
            <select v-model="formData.splitterLevel" :disabled="isEdit" class="form-input">
              <option :value="1">光交</option>
              <option :value="2">一级分光器</option>
              <option :value="3">二级分光器</option>
              <option :value="4">光缆成端</option>
            </select>
          </div>
          <div class="form-group">
            <label>分光比</label>
            <input v-model="formData.splitRatio" type="text" placeholder="如 1:8" class="form-input" />
          </div>
        </div>
        <div class="form-group">
          <label>安装位置</label>
          <input v-model="formData.installLocation" type="text" placeholder="请输入安装位置" class="form-input" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>经度</label>
            <input v-model="formData.longitude" type="text" placeholder="经度" class="form-input" />
          </div>
          <div class="form-group">
            <label>纬度</label>
            <input v-model="formData.latitude" type="text" placeholder="纬度" class="form-input" />
          </div>
        </div>
        <div v-if="!isEdit" class="form-group">
          <label>状态</label>
          <select v-model="formData.status" class="form-input">
            <option :value="1">正常</option>
            <option :value="4">建设中</option>
          </select>
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea v-model="formData.remark" placeholder="请输入备注" class="form-textarea" rows="3"></textarea>
        </div>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showModal = false">取消</button>
          <button class="btn-confirm" @click="handleSubmit" :disabled="submitting">
            {{ submitting ? '提交中...' : '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, h } from 'vue';
import { getCommunities, type CommunityItem } from '@/api/community';
import {
  getSplitterTree,
  createSplitter,
  updateSplitter,
  updateSplitterStatus,
  deleteSplitter,
  type SplitterTreeItem,
} from '@/api/splitter';

const communities = ref<CommunityItem[]>([]);
const selectedCommunityId = ref('');
const searchKeyword = ref('');
const filterStatus = ref<number | ''>('');
const treeLoading = ref(false);
const treeData = ref<SplitterTreeItem[]>([]);

const showModal = ref(false);
const isEdit = ref(false);
const submitting = ref(false);
const editingId = ref('');
const formData = ref({
  splitterName: '',
  communityId: '',
  splitterLevel: 1,
  parentId: '',
  splitRatio: '',
  installLocation: '',
  longitude: '',
  latitude: '',
  status: 1,
  remark: '',
});

const statusMap: Record<number, { label: string; class: string }> = {
  1: { label: '正常', class: 'status-normal' },
  2: { label: '故障', class: 'status-fault' },
  3: { label: '停用', class: 'status-stopped' },
  4: { label: '建设中', class: 'status-building' },
};

const levelMap: Record<number, string> = {
  1: '光交',
  2: '一级分光器',
  3: '二级分光器',
  4: '光缆成端',
};

// 过滤树
const filteredTree = computed(() => {
  if (!searchKeyword.value && filterStatus.value === '') return treeData.value;

  function filterNode(nodes: SplitterTreeItem[]): SplitterTreeItem[] {
    const result: SplitterTreeItem[] = [];
    for (const node of nodes) {
      const children = filterNode(node.children);
      const matchKeyword =
        !searchKeyword.value ||
        node.splitterName.toLowerCase().includes(searchKeyword.value.toLowerCase());
      const matchStatus =
        filterStatus.value === '' || node.status === filterStatus.value;

      if ((matchKeyword && matchStatus) || children.length > 0) {
        result.push({
          ...node,
          children,
        });
      }
    }
    return result;
  }

  return filterNode(treeData.value);
});

async function loadCommunities() {
  try {
    const res = await getCommunities({ page: 1, pageSize: 100, status: 1 });
    communities.value = res.data.list;
  } catch (e) {
    console.error('加载社区列表失败', e);
  }
}

async function loadTree() {
  if (!selectedCommunityId.value) {
    treeData.value = [];
    return;
  }
  treeLoading.value = true;
  try {
    const res = await getSplitterTree(selectedCommunityId.value);
    treeData.value = res.data;
  } catch (e) {
    console.error('加载分光器树失败', e);
    treeData.value = [];
  } finally {
    treeLoading.value = false;
  }
}

function filterTree() {
  // 计算属性自动处理
}

function handleCreateRoot() {
  if (!selectedCommunityId.value) {
    alert('请先选择社区');
    return;
  }
  isEdit.value = false;
  editingId.value = '';
  formData.value = {
    splitterName: '',
    communityId: selectedCommunityId.value,
    splitterLevel: 1,
    parentId: '',
    splitRatio: '',
    installLocation: '',
    longitude: '',
    latitude: '',
    status: 1,
    remark: '',
  };
  showModal.value = true;
}

function handleAddChild(parent: SplitterTreeItem) {
  isEdit.value = false;
  editingId.value = '';
  formData.value = {
    splitterName: '',
    communityId: selectedCommunityId.value,
    splitterLevel: parent.splitterLevel + 1,
    parentId: parent.id,
    splitRatio: '',
    installLocation: '',
    longitude: '',
    latitude: '',
    status: 1,
    remark: '',
  };
  showModal.value = true;
}

function handleEdit(node: SplitterTreeItem) {
  isEdit.value = true;
  editingId.value = node.id;
  formData.value = {
    splitterName: node.splitterName,
    communityId: node.communityId,
    splitterLevel: node.splitterLevel,
    parentId: node.parentId || '',
    splitRatio: node.splitRatio || '',
    installLocation: node.installLocation || '',
    longitude: node.longitude || '',
    latitude: node.latitude || '',
    status: node.status,
    remark: node.remark || '',
  };
  showModal.value = true;
}

async function handleToggleStatus(node: SplitterTreeItem, newStatus: number) {
  if (!confirm(`确定将"${node.splitterName}"状态改为"${statusMap[newStatus]?.label}"吗？`)) return;
  try {
    await updateSplitterStatus(node.id, newStatus);
    alert('状态更新成功');
    loadTree();
  } catch (e: any) {
    alert(e.response?.data?.message || '操作失败');
  }
}

async function handleDelete(node: SplitterTreeItem) {
  if (node.children.length > 0) {
    alert('该节点下有子节点，请先删除子节点');
    return;
  }
  if (node.status !== 3) {
    alert('只有停用状态的分光器才能删除');
    return;
  }
  if (!confirm(`确定删除"${node.splitterName}"吗？`)) return;
  try {
    await deleteSplitter(node.id);
    alert('删除成功');
    loadTree();
  } catch (e: any) {
    alert(e.response?.data?.message || '删除失败');
  }
}

async function handleSubmit() {
  if (!formData.value.splitterName.trim()) {
    alert('请输入分光器名称');
    return;
  }
  submitting.value = true;
  try {
    if (!isEdit.value) {
      const payload = {
        splitterName: formData.value.splitterName,
        communityId: formData.value.communityId,
        splitterLevel: formData.value.splitterLevel,
        splitRatio: formData.value.splitRatio || undefined,
        installLocation: formData.value.installLocation || undefined,
        longitude: formData.value.longitude || undefined,
        latitude: formData.value.latitude || undefined,
        status: formData.value.status,
        remark: formData.value.remark || undefined,
        ...(formData.value.parentId ? { parentId: formData.value.parentId } : {}),
      };
      await createSplitter(payload);
    } else {
      const payload = {
        splitterName: formData.value.splitterName,
        splitRatio: formData.value.splitRatio || undefined,
        installLocation: formData.value.installLocation || undefined,
        longitude: formData.value.longitude || undefined,
        latitude: formData.value.latitude || undefined,
        remark: formData.value.remark || undefined,
      };
      await updateSplitter(editingId.value, payload);
    }
    alert(isEdit.value ? '更新成功' : '创建成功');
    showModal.value = false;
    loadTree();
  } catch (e: any) {
    alert(e.response?.data?.message || '操作失败');
  } finally {
    submitting.value = false;
  }
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
    const statusMapLocal: Record<number, { label: string; class: string }> = {
      1: { label: '正常', class: 'status-normal' },
      2: { label: '故障', class: 'status-fault' },
      3: { label: '停用', class: 'status-stopped' },
      4: { label: '建设中', class: 'status-building' },
    };
    const levelMapLocal: Record<number, string> = {
      1: '光交',
      2: '一级',
      3: '二级',
      4: '成端',
    };

    return () =>
      h('div', { class: 'tree-node-wrapper' }, [
        h(
          'div',
          {
            class: 'tree-node-content',
            style: { paddingLeft: props.level * 24 + 'px' },
          },
          [
            props.node.children.length > 0
              ? h(
                  'span',
                  {
                    class: 'expand-icon',
                    onClick: () => (expanded.value = !expanded.value),
                  },
                  expanded.value ? '▼' : '▶',
                )
              : h('span', { class: 'expand-icon placeholder' }, ''),
            h('span', { class: 'level-badge level-' + props.node.splitterLevel }, levelMapLocal[props.node.splitterLevel]),
            h('span', { class: 'node-name' }, props.node.splitterName),
            h(
              'span',
              { class: 'status-badge ' + statusMapLocal[props.node.status]?.class },
              statusMapLocal[props.node.status]?.label,
            ),
            h('div', { class: 'node-actions' }, [
              props.node.splitterLevel < 4
                ? h(
                    'button',
                    {
                      class: 'btn-link',
                      onClick: () => emit('add-child', props.node),
                    },
                    '+ 子节点',
                  )
                : null,
              h(
                'button',
                { class: 'btn-link', onClick: () => emit('edit', props.node) },
                '编辑',
              ),
              h(
                'select',
                {
                  class: 'status-select',
                  value: props.node.status,
                  onChange: (e: Event) =>
                    emit('toggle-status', props.node, Number((e.target as HTMLSelectElement).value)),
                },
                [
                  h('option', { value: 1 }, '正常'),
                  h('option', { value: 2 }, '故障'),
                  h('option', { value: 3 }, '停用'),
                  h('option', { value: 4 }, '建设中'),
                ],
              ),
              h(
                'button',
                {
                  class: 'btn-link btn-danger',
                  onClick: () => emit('delete', props.node),
                },
                '删除',
              ),
            ]),
          ],
        ),
        expanded.value && props.node.children.length > 0
          ? h(
              'div',
              { class: 'tree-children' },
              props.node.children.map((child: SplitterTreeItem) =>
                h(TreeNode, {
                  key: child.id,
                  node: child,
                  level: props.level + 1,
                  onAddChild: (n: SplitterTreeItem) => emit('add-child', n),
                  onEdit: (n: SplitterTreeItem) => emit('edit', n),
                  onToggleStatus: (n: SplitterTreeItem, s: number) => emit('toggle-status', n, s),
                  onDelete: (n: SplitterTreeItem) => emit('delete', n),
                }),
              ),
            )
          : null,
      ]);
  },
};

onMounted(() => {
  loadCommunities();
});
</script>

<style scoped>
.splitter-container {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 20px 24px;
  padding-bottom: 40px;
}
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-header h2 {
  font-size: 18px;
  color: #333;
  margin: 0;
}
.btn-primary {
  padding: 6px 16px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-primary:hover {
  background: #5a6fc7;
}
.toolbar {
  display: flex;
  gap: 12px;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #eee;
  flex-wrap: wrap;
}
.community-select,
.filter-select {
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  min-width: 160px;
}
.search-input {
  flex: 1;
  min-width: 200px;
  padding: 6px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
}
.tree-container {
  margin: 16px 24px;
  background: #fff;
  border-radius: 8px;
  padding: 8px 0;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.tree-node-wrapper {
  border-bottom: 1px solid #f5f5f5;
}
.tree-node-wrapper:last-child {
  border-bottom: none;
}
.tree-node-content {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  min-height: 40px;
}
.expand-icon {
  width: 20px;
  font-size: 10px;
  color: #999;
  cursor: pointer;
  user-select: none;
}
.expand-icon.placeholder {
  visibility: hidden;
}
.level-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
}
.level-1 {
  background: #667eea;
}
.level-2 {
  background: #2ecc71;
}
.level-3 {
  background: #f39c12;
}
.level-4 {
  background: #9b59b6;
}
.node-name {
  flex: 1;
  font-size: 14px;
  color: #333;
}
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #fff;
}
.status-normal {
  background: #2ecc71;
}
.status-fault {
  background: #e74c3c;
}
.status-stopped {
  background: #95a5a6;
}
.status-building {
  background: #f39c12;
}
.node-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.btn-link {
  background: none;
  border: none;
  color: #667eea;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}
.btn-link:hover {
  text-decoration: underline;
}
.btn-link.btn-danger {
  color: #e74c3c;
}
.status-select {
  padding: 2px 6px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
}
.loading,
.empty-tip {
  text-align: center;
  color: #999;
  padding: 40px;
}
.tree-children {
  background: #fafbfc;
}
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 480px;
  max-width: 90%;
  max-height: 90vh;
  overflow-y: auto;
}
.modal h3 {
  margin: 0 0 20px;
  font-size: 16px;
  color: #333;
}
.form-group {
  margin-bottom: 16px;
}
.form-row {
  display: flex;
  gap: 12px;
}
.form-row .form-group {
  flex: 1;
}
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #555;
}
.required {
  color: #e74c3c;
}
.form-input,
.form-textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}
.form-input:focus,
.form-textarea:focus {
  outline: none;
  border-color: #667eea;
}
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
.btn-cancel {
  padding: 8px 20px;
  background: #f5f5f5;
  color: #666;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-confirm {
  padding: 8px 20px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-confirm:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
