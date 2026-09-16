<template>
  <div class="community-container">
    <div class="page-header">
      <h2>社区管理</h2>
    </div>

    <div class="search-bar">
      <input v-model="search" placeholder="搜索社区名称" @keyup.enter="loadList" class="input" style="width:200px;" />
      <select v-model="filterStatus" @change="loadList" class="select">
        <option value="">全部状态</option>
        <option :value="1">正常</option>
        <option :value="0">停用</option>
      </select>
      <button class="btn btn-primary btn-sm" @click="loadList">查询</button>
      <button class="btn btn-sm" @click="resetFilters">重置</button>
    </div>

    <div class="toolbar">
      <button class="btn btn-primary btn-sm" @click="showCreate = true">+ 新增社区</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>社区名称</th><th>所属区县</th><th>分光器数量</th><th>状态</th>
          <th>停用时间</th><th>备注</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in list" :key="item.id">
          <td>{{ item.communityName }}</td>
          <td>{{ item.regionId || '-' }}</td>
          <td>-</td>
          <td>
            <span class="tag" :class="item.status === 1 ? 'tag-green' : 'tag-orange'">
              {{ item.status === 1 ? '正常' : '停用' }}
            </span>
          </td>
          <td>{{ item.disableTime ? formatTime(item.disableTime) : '-' }}</td>
          <td>{{ item.remark || '-' }}</td>
          <td>
            <button class="btn btn-sm" @click="editItem(item)" :disabled="item.status === 0">编辑</button>
            <button v-if="item.status === 1" class="btn btn-sm" style="color:#fa8c16;" @click="toggleStatus(item)">停用</button>
            <button v-else class="btn btn-sm" style="color:#52c41a;" @click="toggleStatus(item)">恢复启用</button>
            <button v-if="item.status === 0" class="btn btn-sm btn-danger" @click="removeItem(item)">删除</button>
          </td>
        </tr>
        <tr v-if="list.length === 0"><td colspan="7" class="empty-row">暂无数据</td></tr>
      </tbody>
    </table>

    <div class="pagination">
      <span>共 {{ total }} 条</span>
      <button class="page-item" :disabled="page <= 1" @click="page--; loadList()">‹</button>
      <span class="page-item active">{{ page }}</span>
      <button class="page-item" :disabled="page * pageSize >= total" @click="page++; loadList()">›</button>
    </div>

    <div class="tip-box warning">
      ⚠️ 社区删除前置条件：①社区已停用 ②停用满30天。删除时自动批量逻辑删除下属分光器，写入操作日志。停用社区恢复正常后清空停用时间，30天计时重置。
    </div>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-header"><h3>新增社区</h3><button class="btn-close" @click="showCreate = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-group"><label>社区名称 <span class="required">*</span></label><input v-model="createForm.communityName" placeholder="请输入社区名称" class="form-input" /></div>
          <div class="form-group"><label>备注</label><textarea v-model="createForm.remark" rows="3" placeholder="可选" class="form-input"></textarea></div>
          <p v-if="createError" class="error">{{ createError }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showCreate = false">取消</button>
          <button class="btn-confirm" @click="handleCreate" :disabled="submitting">{{ submitting ? '创建中...' : '确定' }}</button>
        </div>
      </div>
    </div>

    <div v-if="showEdit" class="modal-overlay" @click.self="showEdit = false">
      <div class="modal">
        <div class="modal-header"><h3>编辑社区</h3><button class="btn-close" @click="showEdit = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-group"><label>社区名称</label><input v-model="editForm.communityName" class="form-input" /></div>
          <div class="form-group"><label>备注</label><textarea v-model="editForm.remark" rows="3" class="form-input"></textarea></div>
          <p v-if="editError" class="error">{{ editError }}</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showEdit = false">取消</button>
          <button class="btn-confirm" @click="handleEdit">保存</button>
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

function formatTime(t: string) { return new Date(t).toLocaleDateString('zh-CN'); }

async function loadList() {
  const res = await getCommunities({ page: page.value, pageSize, keyword: search.value || undefined, status: filterStatus.value === '' ? undefined : filterStatus.value });
  list.value = res.data.list;
  total.value = res.data.total;
}

function resetFilters() { search.value = ''; filterStatus.value = ''; page.value = 1; loadList(); }

function editItem(item: CommunityItem) {
  editForm.id = item.id; editForm.communityName = item.communityName; editForm.remark = item.remark || '';
  showEdit.value = true; editError.value = '';
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
  try { await deleteCommunity(item.id); await loadList(); }
  catch (e: any) { alert(e.response?.data?.message || '删除失败'); }
}

async function handleCreate() {
  createError.value = '';
  if (!createForm.communityName.trim()) { createError.value = '请输入社区名称'; return; }
  submitting.value = true;
  try {
    await createCommunity({ communityName: createForm.communityName.trim(), remark: createForm.remark || undefined });
    showCreate.value = false; createForm.communityName = ''; createForm.remark = '';
    await loadList();
  } catch (e: any) { createError.value = e.response?.data?.message || '创建失败'; }
  finally { submitting.value = false; }
}

async function handleEdit() {
  editError.value = '';
  try { await updateCommunity(editForm.id, { communityName: editForm.communityName, remark: editForm.remark }); showEdit.value = false; await loadList(); }
  catch (e: any) { editError.value = e.response?.data?.message || '修改失败'; }
}

onMounted(() => { loadList(); });
</script>

<style scoped>
.community-container { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; }
.page-header { margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #333; margin: 0; }
.search-bar { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; }
.input { padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; }
.select { padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; min-width: 120px; }
.btn { padding: 6px 16px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; cursor: pointer; background: #fff; color: #333; }
.btn:hover { border-color: #1890ff; color: #1890ff; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:hover { background: #096dd9; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-danger { color: #ff4d4f; border-color: #ff4d4f; }
.btn-danger:hover { background: #fff1f0; }
.toolbar { margin-bottom: 12px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.data-table th { background: #fafafa; padding: 12px; text-align: left; border-bottom: 1px solid #f0f0f0; color: #666; font-weight: 500; }
.data-table td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
.data-table tr:hover td { background: #f5f5f5; }
.data-table tr.row-deleted td { color: #999; background: #fafafa; }
.empty-row { text-align: center; color: #999; padding: 40px; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }
.pagination { display: flex; align-items: center; gap: 4px; margin-top: 16px; justify-content: flex-end; }
.pagination span { font-size: 13px; color: #666; margin-right: 8px; }
.page-item { min-width: 32px; height: 32px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.page-item.active { background: #1890ff; color: #fff; border-color: #1890ff; }
.page-item:disabled { opacity: 0.4; cursor: not-allowed; }
.tip-box { margin-top: 12px; padding: 8px 12px; border-radius: 4px; font-size: 12px; }
.tip-box.warning { background: #fff7e6; color: #fa8c16; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; width: 440px; max-width: 90vw; overflow: hidden; }
.modal-header { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 16px; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.modal-body { padding: 24px; }
.modal-footer { padding: 12px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 8px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; }
.required { color: #ff4d4f; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; box-sizing: border-box; font-family: inherit; }
.form-input:focus { border-color: #1890ff; outline: none; }
.error { color: #ff4d4f; font-size: 13px; margin: 0 0 12px; }
.btn-cancel { padding: 8px 20px; background: #f5f5f5; color: #666; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm { padding: 8px 20px; background: #1890ff; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
