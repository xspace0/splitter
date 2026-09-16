<template>
  <div class="community-container">
    <div class="page-header">
      <h2>社区管理</h2>
      <button class="btn-primary" @click="showCreate = true">+ 新增社区</button>
    </div>
    <div class="toolbar">
      <input v-model="search" placeholder="搜索社区名称" @keyup.enter="loadList" class="search-input" />
      <select v-model="filterStatus" @change="loadList" class="filter-select">
        <option value="">全部状态</option>
        <option :value="1">正常</option>
        <option :value="0">停用</option>
      </select>
      <button class="btn-search" @click="loadList">查询</button>
    </div>
    <table class="community-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>社区名称</th>
          <th>状态</th>
          <th>备注</th>
          <th>创建时间</th>
          <th>更新时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id" :class="{ disabled: item.status === 0 }">
          <td>{{ item.id }}</td>
          <td>{{ item.communityName }}</td>
          <td><span :class="item.status === 1 ? 'status-active' : 'status-disabled'">{{ item.status === 1 ? '正常' : '停用' }}</span></td>
          <td>{{ item.remark || '-' }}</td>
          <td>{{ formatTime(item.createTime) }}</td>
          <td>{{ formatTime(item.updateTime) }}</td>
          <td class="actions">
            <button class="btn-link" @click="editItem(item)" :disabled="item.status === 0">编辑</button>
            <button class="btn-link" @click="toggleStatus(item)">{{ item.status === 1 ? '停用' : '恢复' }}</button>
            <button class="btn-link danger" @click="removeItem(item)">删除</button>
          </td>
        </tr>
        <tr v-if="list.length === 0">
          <td colspan="7" class="empty">暂无数据</td>
        </tr>
      </tbody>
    </table>
    <div class="pagination">
      <button :disabled="page <= 1" @click="page--; loadList()">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页 ({{ total }} 条)</span>
      <button :disabled="page * pageSize >= total" @click="page++; loadList()">下一页</button>
    </div>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h2>新增社区</h2>
        <div class="form-group"><label>社区名称 <span class="required">*</span></label><input v-model="createForm.communityName" placeholder="请输入社区名称" /></div>
        <div class="form-group"><label>备注</label><textarea v-model="createForm.remark" rows="3" placeholder="可选"></textarea></div>
        <p v-if="createError" class="error">{{ createError }}</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showCreate = false">取消</button>
          <button class="btn-primary" @click="handleCreate" :disabled="submitting">{{ submitting ? '创建中...' : '确定' }}</button>
        </div>
      </div>
    </div>

    <div v-if="showEdit" class="modal-overlay" @click.self="showEdit = false">
      <div class="modal">
        <h2>编辑社区</h2>
        <div class="form-group"><label>社区名称</label><input v-model="editForm.communityName" /></div>
        <div class="form-group"><label>备注</label><textarea v-model="editForm.remark" rows="3"></textarea></div>
        <p v-if="editError" class="error">{{ editError }}</p>
        <div class="modal-actions">
          <button class="btn-cancel" @click="showEdit = false">取消</button>
          <button class="btn-primary" @click="handleEdit">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { getCommunities, createCommunity, updateCommunity, updateCommunityStatus, deleteCommunity, type CommunityItem } from '@/api/community';

const list = ref<CommunityItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const search = ref('');
const filterStatus = ref<number | ''>('');

const showCreate = ref(false);
const showEdit = ref(false);
const createError = ref('');
const editError = ref('');
const submitting = ref(false);

const createForm = reactive({ communityName: '', remark: '' });
const editForm = reactive({ id: '', communityName: '', remark: '' });

function formatTime(t: string) { return new Date(t).toLocaleString('zh-CN'); }

async function loadList() {
  const res = await getCommunities({ page: page.value, pageSize, keyword: search.value || undefined, status: filterStatus.value === '' ? undefined : filterStatus.value });
  list.value = res.data.list;
  total.value = res.data.total;
}

function editItem(item: CommunityItem) {
  editForm.id = item.id;
  editForm.communityName = item.communityName;
  editForm.remark = item.remark || '';
  showEdit.value = true;
  editError.value = '';
}

async function toggleStatus(item: CommunityItem) {
  const newStatus = item.status === 1 ? 0 : 1;
  const action = newStatus === 0 ? '停用' : '恢复启用';
  if (!confirm(`确定要${action}社区 "${item.communityName}" 吗？`)) return;
  await updateCommunityStatus(item.id, newStatus);
  await loadList();
}

async function removeItem(item: CommunityItem) {
  if (!confirm(`确定要删除社区 "${item.communityName}" 吗？删除后社区及下属分光器将被逻辑删除。`)) return;
  try {
    await deleteCommunity(item.id);
    await loadList();
  } catch (e: any) {
    alert(e.response?.data?.message || '删除失败');
  }
}

async function handleCreate() {
  createError.value = '';
  if (!createForm.communityName.trim()) { createError.value = '请输入社区名称'; return; }
  submitting.value = true;
  try {
    await createCommunity({ communityName: createForm.communityName.trim(), remark: createForm.remark || undefined });
    showCreate.value = false;
    createForm.communityName = '';
    createForm.remark = '';
    await loadList();
  } catch (e: any) {
    createError.value = e.response?.data?.message || '创建失败';
  } finally {
    submitting.value = false;
  }
}

async function handleEdit() {
  editError.value = '';
  try {
    await updateCommunity(editForm.id, { communityName: editForm.communityName, remark: editForm.remark });
    showEdit.value = false;
    await loadList();
  } catch (e: any) {
    editError.value = e.response?.data?.message || '修改失败';
  }
}

onMounted(() => { loadList(); });
</script>

<style scoped>
.community-container { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; }
.page-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #333; margin: 0; }
.btn-primary { padding: 8px 20px; background: #667eea; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-primary:hover:not(:disabled) { background: #5a6fc7; }
.btn-primary:disabled { opacity: .6; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.search-input { flex: 1; max-width: 300px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.filter-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.btn-search { padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.community-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
.community-table th { background: #f8f9fa; padding: 12px 10px; text-align: left; font-size: 13px; color: #666; border-bottom: 1px solid #e8e8e8; }
.community-table td { padding: 10px; font-size: 13px; color: #333; border-bottom: 1px solid #f0f0f0; }
.community-table tr:hover td { background: #fafbfc; }
.community-table tr.disabled td { color: #999; background: #fafafa; }
.empty { text-align: center; color: #999; padding: 40px; }
.status-active { color: #2ecc71; }
.status-disabled { color: #e74c3c; }
.actions { display: flex; gap: 4px; }
.btn-link { background: none; border: none; color: #667eea; cursor: pointer; font-size: 13px; padding: 2px 4px; }
.btn-link:hover { text-decoration: underline; }
.btn-link:disabled { color: #ccc; cursor: not-allowed; text-decoration: none; }
.btn-link.danger { color: #e74c3c; }
.pagination { display: flex; align-items: center; gap: 16px; justify-content: center; margin-top: 16px; font-size: 14px; color: #666; }
.pagination button { padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; }
.pagination button:disabled { opacity: .5; cursor: not-allowed; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; border-radius: 12px; padding: 32px; width: 440px; max-width: 90vw; }
.modal h2 { margin: 0 0 24px; font-size: 18px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 14px; color: #555; }
.form-group .required { color: #e74c3c; }
.form-group input, .form-group textarea { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; font-family: inherit; }
.form-group input:focus, .form-group textarea:focus { border-color: #667eea; outline: none; }
.form-group textarea { resize: vertical; }
.error { color: #e74c3c; font-size: 13px; margin: 0 0 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.btn-cancel { padding: 8px 16px; background: #f1f2f6; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
</style>
