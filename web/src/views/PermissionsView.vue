<template>
  <div class="permission-container">
    <div class="page-header">
      <h2>权限分配</h2>
    </div>

    <div class="toolbar">
      <input v-model="searchKeyword" placeholder="搜索用户名/账号" @keyup.enter="loadAssignments" class="search-input" />
      <select v-model="filterCommunity" @change="loadAssignments" class="filter-select">
        <option value="">全部社区</option>
        <option v-for="c in communities" :key="c.id" :value="c.id">{{ c.communityName }}</option>
      </select>
      <button class="btn-search" @click="loadAssignments">查询</button>
      <button class="btn-primary" @click="showAssignModal = true">+ 分配权限</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>用户</th>
          <th>账号</th>
          <th>角色</th>
          <th>社区</th>
          <th>状态</th>
          <th>分配时间</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in assignments" :key="item.id">
          <td>{{ item.username }}</td>
          <td>{{ item.account }}</td>
          <td><span class="role-tag" :class="'role-' + roleLevel(item.roleType)">{{ roleLabel(item.roleType) }}</span></td>
          <td>{{ item.communityName }}</td>
          <td>
            <span class="status-badge" :class="item.status === 1 ? 'status-active' : 'status-removed'">
              {{ item.status === 1 ? '有效' : '已移除' }}
            </span>
          </td>
          <td>{{ formatTime(item.createTime) }}</td>
          <td>
            <button v-if="item.status === 1" class="btn-link btn-danger" @click="handleRemove(item)">移除</button>
            <span v-else class="text-muted">--</span>
          </td>
        </tr>
        <tr v-if="assignments.length === 0">
          <td colspan="7" class="empty-row">暂无数据</td>
        </tr>
      </tbody>
    </table>

    <!-- 分配权限弹窗 -->
    <div v-if="showAssignModal" class="modal-overlay" @click.self="showAssignModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>分配社区权限</h3>
          <button class="btn-close" @click="showAssignModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>选择用户 <span class="required">*</span></label>
            <select v-model="assignForm.userId" @change="onUserSelected" class="form-input">
              <option value="">请选择用户</option>
              <option v-for="u in assignableUsers" :key="u.id" :value="u.id">
                {{ u.username }} ({{ u.account }}) - {{ roleLabel(u.roleType) }}
              </option>
            </select>
          </div>
          <div v-if="assignForm.userId" class="form-group">
            <label>选择社区 <span class="required">*</span></label>
            <div class="community-list">
              <label v-for="c in communities" :key="c.id" class="checkbox-item">
                <input type="checkbox" :value="c.id" v-model="assignForm.communityIds" :disabled="c.status !== 1" />
                <span>{{ c.communityName }}</span>
                <span v-if="c.status !== 1" class="text-muted">(已停用)</span>
              </label>
              <div v-if="communities.length === 0" class="text-muted">暂无可用社区</div>
            </div>
          </div>
          <div v-if="assignedCommunityIds.length > 0" class="form-group">
            <label>已分配社区</label>
            <div class="assigned-list">
              <span v-for="ac in assignedCommunityIds" :key="ac" class="assigned-tag">{{ getCommunityName(ac) }}</span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showAssignModal = false">取消</button>
          <button class="btn-confirm" @click="handleAssign" :disabled="submitting">
            {{ submitting ? '提交中...' : '确定分配' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 移除确认弹窗 -->
    <div v-if="showRemoveModal" class="modal-overlay" @click.self="showRemoveModal = false">
      <div class="modal modal-sm">
        <div class="modal-header">
          <h3>确认移除</h3>
          <button class="btn-close" @click="showRemoveModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <p>确定要移除 <strong>{{ removeTarget?.username }}</strong> 对社区 <strong>{{ removeTarget?.communityName }}</strong> 的权限吗？</p>
          <p class="text-muted" style="margin-top: 8px;">移除后，该用户将无法查看和管理该社区的分光器数据。</p>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showRemoveModal = false">取消</button>
          <button class="btn-confirm btn-danger" @click="confirmRemove" :disabled="submitting">确认移除</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { getCommunities, type CommunityItem } from '@/api/community';
import { getAssignments, assignPermission, removePermission, type AssignmentItem } from '@/api/permission';
import { getUsers, type UserItem } from '@/api/user';

const searchKeyword = ref('');
const filterCommunity = ref('');
const assignments = ref<AssignmentItem[]>([]);
const communities = ref<CommunityItem[]>([]);
const assignableUsers = ref<UserItem[]>([]);
const assignedCommunityIds = ref<string[]>([]);

const showAssignModal = ref(false);
const showRemoveModal = ref(false);
const submitting = ref(false);
const removeTarget = ref<AssignmentItem | null>(null);

const assignForm = reactive({
  userId: '',
  communityIds: [] as string[],
});

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  REGION_ADMIN: '区域管理员',
  ADMIN: '管理员',
  OPERATOR: '操作员',
  VIEWER: '查看者',
};

function roleLabel(role: string) {
  return roleLabels[role] || role;
}

function roleLevel(role: string) {
  const map: Record<string, number> = { SUPER_ADMIN: 1, REGION_ADMIN: 2, ADMIN: 3, OPERATOR: 4, VIEWER: 5 };
  return map[role] || 5;
}

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN');
}

function getCommunityName(id: string) {
  return communities.value.find((c) => c.id === id)?.communityName || id;
}

async function loadCommunities() {
  try {
    const res = await getCommunities({ page: 1, pageSize: 100 });
    communities.value = res.data.list;
  } catch (e) {
    console.error('加载社区失败', e);
  }
}

async function loadAssignableUsers() {
  try {
    const res = await getUsers({ page: 1, pageSize: 100 });
    assignableUsers.value = res.data.list.filter(
      (u) => u.roleType === 'OPERATOR' || u.roleType === 'VIEWER',
    );
  } catch (e) {
    console.error('加载用户失败', e);
  }
}

async function loadAssignments() {
  try {
    const params: { userId?: string; communityId?: string } = {};
    if (filterCommunity.value) params.communityId = filterCommunity.value;
    const res = await getAssignments(params);
    let list = res.data.list;
    if (searchKeyword.value) {
      const kw = searchKeyword.value.toLowerCase();
      list = list.filter(
        (a) => a.username.toLowerCase().includes(kw) || a.account.toLowerCase().includes(kw),
      );
    }
    assignments.value = list;
  } catch (e) {
    console.error('加载权限列表失败', e);
    assignments.value = [];
  }
}

async function onUserSelected() {
  assignedCommunityIds.value = [];
  if (!assignForm.userId) return;
  try {
    const { getUserCommunities } = await import('@/api/permission');
    const res = await getUserCommunities(assignForm.userId);
    assignedCommunityIds.value = res.data.communities
      .filter((c) => c.status === 1 && c.community)
      .map((c) => c.community!.id);
  } catch {
    // 忽略
  }
}

async function handleAssign() {
  if (!assignForm.userId) {
    alert('请选择用户');
    return;
  }
  if (assignForm.communityIds.length === 0) {
    alert('请至少选择一个社区');
    return;
  }
  submitting.value = true;
  try {
    await assignPermission({
      userId: assignForm.userId,
      communityIds: assignForm.communityIds,
    });
    alert('权限分配成功');
    showAssignModal.value = false;
    assignForm.userId = '';
    assignForm.communityIds = [];
    assignedCommunityIds.value = [];
    loadAssignments();
  } catch (e: any) {
    alert(e.response?.data?.message || '分配失败');
  } finally {
    submitting.value = false;
  }
}

function handleRemove(item: AssignmentItem) {
  removeTarget.value = item;
  showRemoveModal.value = true;
}

async function confirmRemove() {
  if (!removeTarget.value) return;
  submitting.value = true;
  try {
    await removePermission({
      userId: removeTarget.value.userId,
      communityIds: [removeTarget.value.communityId],
    });
    alert('权限移除成功');
    showRemoveModal.value = false;
    removeTarget.value = null;
    loadAssignments();
  } catch (e: any) {
    alert(e.response?.data?.message || '移除失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(() => {
  loadCommunities();
  loadAssignableUsers();
  loadAssignments();
});
</script>

<style scoped>
.permission-container {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 20px 24px;
}
.page-header {
  margin-bottom: 16px;
}
.page-header h2 {
  font-size: 18px;
  color: #333;
  margin: 0;
}
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
  flex-wrap: wrap;
}
.search-input {
  flex: 1;
  min-width: 200px;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
}
.filter-select {
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
  min-width: 160px;
}
.btn-search {
  padding: 8px 20px;
  background: #fff;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-primary {
  padding: 8px 20px;
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  margin-left: auto;
}
.btn-primary:hover {
  background: #096dd9;
}
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.data-table th {
  background: #fafafa;
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid #f0f0f0;
  color: #666;
  font-weight: 500;
}
.data-table td {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
}
.data-table tr:hover td {
  background: #f5f5f5;
}
.empty-row {
  text-align: center;
  color: #999;
  padding: 40px;
}
.role-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 12px;
}
.role-1 { background: #fde8e8; color: #e74c3c; }
.role-2 { background: #fef3e2; color: #f39c12; }
.role-3 { background: #e8f5e9; color: #27ae60; }
.role-4 { background: #e3f2fd; color: #2196f3; }
.role-5 { background: #f3e5f5; color: #9c27b0; }
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}
.status-active { background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; }
.status-removed { background: #fafafa; color: #999; border: 1px solid #d9d9d9; }
.btn-link {
  background: none;
  border: none;
  color: #1890ff;
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
}
.btn-link:hover { text-decoration: underline; }
.btn-link.btn-danger { color: #ff4d4f; }
.text-muted { color: #999; font-size: 12px; }
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal {
  background: #fff;
  border-radius: 8px;
  width: 560px;
  max-width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}
.modal-sm {
  width: 420px;
}
.modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.modal-header h3 { font-size: 16px; margin: 0; }
.btn-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}
.modal-body { padding: 24px; }
.modal-footer {
  padding: 12px 24px;
  border-top: 1px solid #f0f0f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.form-group { margin-bottom: 20px; }
.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: #666;
}
.required { color: #ff4d4f; }
.form-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 13px;
  box-sizing: border-box;
}
.community-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid #f0f0f0;
  border-radius: 6px;
  padding: 12px;
}
.checkbox-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 0;
  font-size: 13px;
  cursor: pointer;
}
.checkbox-item input { cursor: pointer; }
.assigned-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.assigned-tag {
  display: inline-block;
  padding: 2px 10px;
  background: #e6f7ff;
  color: #1890ff;
  border: 1px solid #91d5ff;
  border-radius: 4px;
  font-size: 12px;
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
  background: #1890ff;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-confirm.btn-danger { background: #ff4d4f; }
</style>
