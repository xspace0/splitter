<template>
  <div class="users-container">
    <div class="page-header">
      <h2>用户管理</h2>
    </div>

    <div class="search-bar">
      <input v-model="search" placeholder="搜索姓名/账号" @keyup.enter="loadUsers" class="input" style="width:200px;" />
      <select v-model="filterRole" @change="loadUsers" class="select">
        <option value="">全部角色</option>
        <option v-for="[key, label] in Object.entries(roleLabels)" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="filterStatus" @change="loadUsers" class="select">
        <option value="">全部状态</option>
        <option :value="1">启用</option>
        <option :value="0">禁用</option>
      </select>
      <button class="btn btn-primary btn-sm" @click="loadUsers">查询</button>
      <button class="btn btn-sm" @click="resetFilters">重置</button>
    </div>

    <div class="toolbar">
      <button class="btn btn-primary btn-sm" @click="showCreate = true">+ 新增PC账号</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>姓名</th><th>账号</th><th>角色</th><th>所属区域</th>
          <th>实名认证</th><th>状态</th><th>最后登录</th><th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.username }}</td>
          <td>{{ user.account || '-' }}</td>
          <td><span class="role-tag" :class="'role-' + roleLevel(user.roleType)">{{ roleLabels[user.roleType] || user.roleType }}</span></td>
          <td>{{ user.regionId || '-' }}</td>
          <td>
            <span class="tag" :class="user.realNameVerified ? 'tag-green' : 'tag-red'">
              {{ user.realNameVerified ? '已认证' : '未认证' }}
            </span>
          </td>
          <td>
            <span class="tag" :class="user.status === 1 ? 'tag-green' : 'tag-gray'">
              {{ user.status === 1 ? '启用' : '禁用' }}
            </span>
          </td>
          <td>{{ user.lastLoginTime ? formatTime(user.lastLoginTime) : '-' }}</td>
          <td>
            <button class="btn btn-sm" @click="editUser(user)">编辑</button>
            <button class="btn btn-sm" @click="changeRole(user)">角色切换</button>
            <button v-if="user.account" class="btn btn-sm" @click="resetPwd(user)">重置密码</button>
            <button v-if="user.status === 1" class="btn btn-sm" style="color:#ff4d4f;" @click="toggleStatus(user)">禁用</button>
            <button v-else class="btn btn-sm" style="color:#52c41a;" @click="toggleStatus(user)">启用</button>
          </td>
        </tr>
        <tr v-if="users.length === 0"><td colspan="8" class="empty-row">暂无数据</td></tr>
      </tbody>
    </table>

    <div class="pagination">
      <span>共 {{ total }} 条</span>
      <button class="page-item" :disabled="page <= 1" @click="page--; loadUsers()">‹</button>
      <span class="page-item active">{{ page }}</span>
      <button class="page-item" :disabled="page * pageSize >= total" @click="page++; loadUsers()">›</button>
    </div>

    <div class="tip-box info">
      💡 角色切换规则：提升至操作员及以上角色需校验实名认证；区域管理员仅可切换查看者⇋管理员；管理员仅可切换查看者⇋操作员。小程序用户升级管理员需补充账号密码。
    </div>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <div class="modal-header"><h3>新增PC账号</h3><button class="btn-close" @click="showCreate = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-group"><label>姓名 <span class="required">*</span></label><input v-model="createForm.username" placeholder="姓名" class="form-input" /></div>
          <div class="form-group"><label>账号 <span class="required">*</span></label><input v-model="createForm.account" placeholder="登录账号" class="form-input" /></div>
          <div class="form-group"><label>密码 <span class="required">*</span></label><input v-model="createForm.password" type="password" placeholder="至少6位" class="form-input" /></div>
          <div class="form-group"><label>角色 <span class="required">*</span></label>
            <select v-model="createForm.roleType" class="form-input"><option v-for="[key, label] in Object.entries(roleLabels)" :key="key" :value="key">{{ label }}</option></select>
          </div>
          <div class="form-group"><label>手机号</label><input v-model="createForm.phone" placeholder="可选" class="form-input" /></div>
          <p v-if="createError" class="error">{{ createError }}</p>
        </div>
        <div class="modal-footer"><button class="btn-cancel" @click="showCreate = false">取消</button><button class="btn-confirm" @click="handleCreate" :disabled="creating">{{ creating ? '创建中...' : '确定' }}</button></div>
      </div>
    </div>

    <div v-if="showEdit" class="modal-overlay" @click.self="showEdit = false">
      <div class="modal">
        <div class="modal-header"><h3>编辑用户</h3><button class="btn-close" @click="showEdit = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-group"><label>姓名</label><input v-model="editForm.username" class="form-input" /></div>
          <div class="form-group"><label>手机号</label><input v-model="editForm.phone" class="form-input" /></div>
          <p v-if="editError" class="error">{{ editError }}</p>
        </div>
        <div class="modal-footer"><button class="btn-cancel" @click="showEdit = false">取消</button><button class="btn-confirm" @click="handleEdit">保存</button></div>
      </div>
    </div>

    <div v-if="showReset" class="modal-overlay" @click.self="showReset = false">
      <div class="modal">
        <div class="modal-header"><h3>重置密码 - {{ resetTarget?.account }}</h3><button class="btn-close" @click="showReset = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-group"><label>新密码 <span class="required">*</span></label><input v-model="resetForm.newPassword" type="password" placeholder="至少6位" class="form-input" /></div>
          <p v-if="resetError" class="error">{{ resetError }}</p>
        </div>
        <div class="modal-footer"><button class="btn-cancel" @click="showReset = false">取消</button><button class="btn-confirm" @click="handleReset">确定</button></div>
      </div>
    </div>

    <div v-if="showRole" class="modal-overlay" @click.self="showRole = false">
      <div class="modal">
        <div class="modal-header"><h3>切换角色 - {{ roleTarget?.account }}</h3><button class="btn-close" @click="showRole = false">&times;</button></div>
        <div class="modal-body">
          <div class="form-group"><label>新角色</label>
            <select v-model="roleForm.roleType" class="form-input"><option v-for="[key, label] in Object.entries(roleLabels)" :key="key" :value="key">{{ label }}</option></select>
          </div>
          <p v-if="roleError" class="error">{{ roleError }}</p>
        </div>
        <div class="modal-footer"><button class="btn-cancel" @click="showRole = false">取消</button><button class="btn-confirm" @click="handleRole">确定</button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { getUsers, createUser, updateUser, updateUserStatus, resetPassword, updateUserRole, type UserItem } from '@/api/user';

const users = ref<UserItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;
const search = ref('');
const filterRole = ref('');
const filterStatus = ref<number | ''>('');
const roleLabels: Record<string, string> = { SUPER_ADMIN: '超级管理员', REGION_ADMIN: '区域管理员', ADMIN: '管理员', OPERATOR: '操作员', VIEWER: '查看者' };

const showCreate = ref(false);
const showEdit = ref(false);
const showReset = ref(false);
const showRole = ref(false);
const createError = ref('');
const editError = ref('');
const resetError = ref('');
const roleError = ref('');
const creating = ref(false);

const createForm = reactive({ username: '', account: '', password: '', roleType: 'VIEWER', phone: '' });
const editForm = reactive({ id: '', username: '', phone: '' });
const resetForm = reactive({ newPassword: '' });
const roleForm = reactive({ roleType: '' });
const editTarget = ref<UserItem | null>(null);
const resetTarget = ref<UserItem | null>(null);
const roleTarget = ref<UserItem | null>(null);

function formatTime(t: string) { return new Date(t).toLocaleString('zh-CN'); }
function roleLevel(role: string) {
  const map: Record<string, number> = { SUPER_ADMIN: 1, REGION_ADMIN: 2, ADMIN: 3, OPERATOR: 4, VIEWER: 5 };
  return map[role] || 5;
}

async function loadUsers() {
  const res = await getUsers({ page: page.value, pageSize, keyword: search.value || undefined, roleType: filterRole.value || undefined, status: filterStatus.value === '' ? undefined : filterStatus.value });
  users.value = res.data.list;
  total.value = res.data.total;
}

function resetFilters() { search.value = ''; filterRole.value = ''; filterStatus.value = ''; page.value = 1; loadUsers(); }
function editUser(u: UserItem) { editTarget.value = u; editForm.id = u.id; editForm.username = u.username; editForm.phone = u.phone || ''; showEdit.value = true; editError.value = ''; }
function resetPwd(u: UserItem) { resetTarget.value = u; resetForm.newPassword = ''; showReset.value = true; resetError.value = ''; }
function changeRole(u: UserItem) { roleTarget.value = u; roleForm.roleType = u.roleType; showRole.value = true; roleError.value = ''; }
async function toggleStatus(u: UserItem) { await updateUserStatus(u.id, u.status === 1 ? 0 : 1); await loadUsers(); }
async function handleCreate() {
  createError.value = '';
  if (!createForm.username || !createForm.account || !createForm.password) { createError.value = '请填写必填项'; return; }
  creating.value = true;
  try { await createUser({ ...createForm }); showCreate.value = false; await loadUsers(); } catch (e: any) { createError.value = e.response?.data?.message || '创建失败'; } finally { creating.value = false; }
}
async function handleEdit() {
  editError.value = '';
  try { await updateUser(editForm.id, { username: editForm.username, phone: editForm.phone }); showEdit.value = false; await loadUsers(); } catch (e: any) { editError.value = e.response?.data?.message || '修改失败'; }
}
async function handleReset() {
  resetError.value = '';
  if (resetForm.newPassword.length < 6) { resetError.value = '密码至少6位'; return; }
  try { await resetPassword(resetTarget.value!.id, resetForm.newPassword); showReset.value = false; } catch (e: any) { resetError.value = e.response?.data?.message || '重置失败'; }
}
async function handleRole() {
  roleError.value = '';
  try { await updateUserRole(roleTarget.value!.id, roleForm.roleType); showRole.value = false; await loadUsers(); } catch (e: any) { roleError.value = e.response?.data?.message || '切换失败'; }
}

onMounted(() => { loadUsers(); });
</script>

<style scoped>
.users-container { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; }
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
.toolbar { margin-bottom: 12px; }
.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.data-table th { background: #fafafa; padding: 12px; text-align: left; border-bottom: 1px solid #f0f0f0; color: #666; font-weight: 500; }
.data-table td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
.data-table tr:hover td { background: #f5f5f5; }
.empty-row { text-align: center; color: #999; padding: 40px; }
.role-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.role-1 { background: #fde8e8; color: #e74c3c; }
.role-2 { background: #fef3e2; color: #f39c12; }
.role-3 { background: #e8f5e9; color: #27ae60; }
.role-4 { background: #e3f2fd; color: #2196f3; }
.role-5 { background: #f3e5f5; color: #9c27b0; }
.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }
.tag-gray { background: #fafafa; color: #999; border-color: #d9d9d9; }
.pagination { display: flex; align-items: center; gap: 4px; margin-top: 16px; justify-content: flex-end; }
.pagination span { font-size: 13px; color: #666; margin-right: 8px; }
.page-item { min-width: 32px; height: 32px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.page-item.active { background: #1890ff; color: #fff; border-color: #1890ff; }
.page-item:disabled { opacity: 0.4; cursor: not-allowed; }
.tip-box { margin-top: 12px; padding: 8px 12px; border-radius: 4px; font-size: 12px; }
.tip-box.info { background: #e6f7ff; color: #1890ff; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; width: 420px; max-width: 90vw; overflow: hidden; }
.modal-header { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 16px; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.modal-body { padding: 24px; }
.modal-footer { padding: 12px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 8px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; }
.required { color: #ff4d4f; }
.form-input { width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
.form-input:focus { border-color: #1890ff; outline: none; }
.error { color: #ff4d4f; font-size: 13px; margin: 0 0 12px; }
.btn-cancel { padding: 8px 20px; background: #f5f5f5; color: #666; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm { padding: 8px 20px; background: #1890ff; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
