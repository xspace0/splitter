<template>
  <div class="users-container">
    <div class="header">
      <h1>用户管理</h1>
      <button class="btn-primary" @click="showCreate = true">+ 新增用户</button>
    </div>
    <div class="toolbar">
      <input v-model="search" placeholder="搜索姓名/账号/手机号" @keyup.enter="loadUsers" class="search-input" />
      <select v-model="filterRole" @change="loadUsers" class="filter-select">
        <option value="">全部角色</option>
        <option v-for="[key, label] in Object.entries(roleLabels)" :key="key" :value="key">{{ label }}</option>
      </select>
      <select v-model="filterStatus" @change="loadUsers" class="filter-select">
        <option value="">全部状态</option>
        <option :value="1">启用</option>
        <option :value="0">禁用</option>
      </select>
      <button class="btn-search" @click="loadUsers">查询</button>
    </div>
    <table class="user-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>姓名</th>
          <th>账号</th>
          <th>角色</th>
          <th>手机号</th>
          <th>实名</th>
          <th>状态</th>
          <th>最后登录</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="user in users" :key="user.id">
          <td>{{ user.id }}</td>
          <td>{{ user.username }}</td>
          <td>{{ user.account }}</td>
          <td><span class="role-tag" :class="'role-' + user.roleType.toLowerCase()">{{ roleLabels[user.roleType] || user.roleType }}</span></td>
          <td>{{ user.phone || '-' }}</td>
          <td>{{ user.realNameVerified ? '已认证' : '未认证' }}</td>
          <td><span :class="user.status === 1 ? 'status-active' : 'status-disabled'">{{ user.status === 1 ? '启用' : '禁用' }}</span></td>
          <td>{{ user.lastLoginTime ? formatTime(user.lastLoginTime) : '从未' }}</td>
          <td class="actions">
            <button class="btn-link" @click="editUser(user)">编辑</button>
            <button class="btn-link" @click="toggleStatus(user)">{{ user.status === 1 ? '禁用' : '启用' }}</button>
            <button class="btn-link" @click="resetPwd(user)">重置密码</button>
            <button class="btn-link" @click="changeRole(user)">角色</button>
          </td>
        </tr>
        <tr v-if="users.length === 0">
          <td colspan="9" class="empty">暂无数据</td>
        </tr>
      </tbody>
    </table>
    <div class="pagination">
      <button :disabled="page <= 1" @click="page--; loadUsers()">上一页</button>
      <span>第 {{ page }} 页 / 共 {{ Math.ceil(total / pageSize) }} 页 ({{ total }} 条)</span>
      <button :disabled="page * pageSize >= total" @click="page++; loadUsers()">下一页</button>
    </div>

    <div v-if="showCreate" class="modal-overlay" @click.self="showCreate = false">
      <div class="modal">
        <h2>新增用户</h2>
        <div class="form-group"><label>姓名</label><input v-model="createForm.username" placeholder="姓名" /></div>
        <div class="form-group"><label>账号</label><input v-model="createForm.account" placeholder="登录账号" /></div>
        <div class="form-group"><label>密码</label><input v-model="createForm.password" type="password" placeholder="至少6位" /></div>
        <div class="form-group"><label>角色</label>
          <select v-model="createForm.roleType"><option v-for="[key, label] in Object.entries(roleLabels)" :key="key" :value="key">{{ label }}</option></select>
        </div>
        <div class="form-group"><label>手机号</label><input v-model="createForm.phone" placeholder="可选" /></div>
        <p v-if="createError" class="error">{{ createError }}</p>
        <div class="modal-actions"><button class="btn-cancel" @click="showCreate = false">取消</button><button class="btn-primary" @click="handleCreate" :disabled="creating">{{ creating ? '创建中...' : '确定' }}</button></div>
      </div>
    </div>

    <div v-if="showEdit" class="modal-overlay" @click.self="showEdit = false">
      <div class="modal">
        <h2>编辑用户</h2>
        <div class="form-group"><label>姓名</label><input v-model="editForm.username" /></div>
        <div class="form-group"><label>手机号</label><input v-model="editForm.phone" /></div>
        <p v-if="editError" class="error">{{ editError }}</p>
        <div class="modal-actions"><button class="btn-cancel" @click="showEdit = false">取消</button><button class="btn-primary" @click="handleEdit">保存</button></div>
      </div>
    </div>

    <div v-if="showReset" class="modal-overlay" @click.self="showReset = false">
      <div class="modal">
        <h2>重置密码 - {{ resetTarget?.account }}</h2>
        <div class="form-group"><label>新密码</label><input v-model="resetForm.newPassword" type="password" placeholder="至少6位" /></div>
        <p v-if="resetError" class="error">{{ resetError }}</p>
        <div class="modal-actions"><button class="btn-cancel" @click="showReset = false">取消</button><button class="btn-primary" @click="handleReset">确定</button></div>
      </div>
    </div>

    <div v-if="showRole" class="modal-overlay" @click.self="showRole = false">
      <div class="modal">
        <h2>切换角色 - {{ roleTarget?.account }}</h2>
        <div class="form-group"><label>新角色</label>
          <select v-model="roleForm.roleType"><option v-for="[key, label] in Object.entries(roleLabels)" :key="key" :value="key">{{ label }}</option></select>
        </div>
        <p v-if="roleError" class="error">{{ roleError }}</p>
        <div class="modal-actions"><button class="btn-cancel" @click="showRole = false">取消</button><button class="btn-primary" @click="handleRole">确定</button></div>
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

async function loadUsers() {
  const res = await getUsers({ page: page.value, pageSize, keyword: search.value || undefined, roleType: filterRole.value || undefined, status: filterStatus.value === '' ? undefined : filterStatus.value });
  users.value = res.data.list;
  total.value = res.data.total;
}

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
.users-container { min-height: 100vh; background: #f5f6fa; padding: 16px 24px; }
.header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.header h1 { font-size: 20px; color: #333; margin: 0; }
.btn-primary { padding: 8px 20px; background: #667eea; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
.btn-primary:hover:not(:disabled) { background: #5a6fc7; }
.btn-primary:disabled { opacity: .6; }
.toolbar { display: flex; gap: 8px; margin-bottom: 16px; }
.search-input { flex: 1; max-width: 300px; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.filter-select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
.btn-search { padding: 8px 16px; background: #e2e8f0; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
.user-table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.06); }
.user-table th { background: #f8f9fa; padding: 12px 10px; text-align: left; font-size: 13px; color: #666; border-bottom: 1px solid #e8e8e8; }
.user-table td { padding: 10px; font-size: 13px; color: #333; border-bottom: 1px solid #f0f0f0; }
.user-table tr:hover td { background: #fafbfc; }
.empty { text-align: center; color: #999; padding: 40px; }
.role-tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; color: #fff; }
.role-super_admin { background: #e74c3c; }
.role-region_admin { background: #e67e22; }
.role-admin { background: #3498db; }
.role-operator { background: #2ecc71; }
.role-viewer { background: #95a5a6; }
.status-active { color: #2ecc71; }
.status-disabled { color: #e74c3c; }
.actions { display: flex; gap: 4px; }
.btn-link { background: none; border: none; color: #667eea; cursor: pointer; font-size: 13px; padding: 2px 4px; }
.btn-link:hover { text-decoration: underline; }
.pagination { display: flex; align-items: center; gap: 16px; justify-content: center; margin-top: 16px; font-size: 14px; color: #666; }
.pagination button { padding: 6px 12px; border: 1px solid #ddd; background: #fff; border-radius: 6px; cursor: pointer; }
.pagination button:disabled { opacity: .5; cursor: not-allowed; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal { background: #fff; border-radius: 12px; padding: 32px; width: 420px; max-width: 90vw; }
.modal h2 { margin: 0 0 24px; font-size: 18px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 14px; color: #555; }
.form-group input, .form-group select { width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; box-sizing: border-box; }
.form-group input:focus, .form-group select:focus { border-color: #667eea; outline: none; }
.error { color: #e74c3c; font-size: 13px; margin: 0 0 12px; }
.modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
.btn-cancel { padding: 8px 16px; background: #f1f2f6; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; }
</style>
