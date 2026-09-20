<template>
  <div class="profile-container">
    <div class="page-header">
      <h2>个人中心</h2>
    </div>

    <div v-if="loading" class="loading">加载中...</div>
    <div v-else class="profile-content">
      <!-- 用户头像区 -->
      <div class="user-header">
        <div class="avatar">{{ avatarChar }}</div>
        <div class="user-meta">
          <div class="user-name">{{ profile?.username || '未知' }}</div>
          <div class="user-tags">
            <span class="role-tag" :class="'role-' + roleLevel">{{ roleLabel }}</span>
            <span class="tag" :class="profile?.realNameVerified ? 'tag-green' : 'tag-red'">
              {{ profile?.realNameVerified ? '已认证' : '未认证' }}
            </span>
          </div>
        </div>
      </div>

      <!-- 个人信息表单 -->
      <h3 class="section-title">个人信息</h3>
      <div class="form-group">
        <label>姓名</label>
        <input v-model="profileForm.username" class="form-input" placeholder="请输入姓名" />
      </div>
      <div class="form-group">
        <label>登录账号</label>
        <input :value="profile?.account" class="form-input" disabled />
      </div>
      <div class="form-group">
        <label>手机号</label>
        <input v-model="profileForm.phone" class="form-input" placeholder="请输入手机号" />
      </div>
      <div class="form-group">
        <label>实名认证</label>
        <input :value="profile?.realNameVerified ? '已认证' : '未认证'" class="form-input" disabled />
      </div>
      <div class="form-group">
        <label>最后登录时间</label>
        <input :value="formatTime(profile?.lastLoginTime ?? null)" class="form-input" disabled />
      </div>
      <button class="btn btn-primary" @click="handleSaveProfile" :disabled="savingProfile">
        {{ savingProfile ? '保存中...' : '保存修改' }}
      </button>

      <!-- 分隔线 -->
      <div class="divider"></div>

      <!-- 修改密码 -->
      <h3 class="section-title">修改密码</h3>
      <div class="form-group">
        <label>原密码</label>
        <div class="password-row">
          <input v-model="passwordForm.oldPassword" type="password" class="form-input" placeholder="请输入原密码" />
          <a class="forgot-link" @click="showForgotTip">忘记原密码？</a>
        </div>
      </div>
      <div class="form-group">
        <label>新密码</label>
        <input v-model="passwordForm.newPassword" type="password" class="form-input" placeholder="请输入新密码（至少8位，含字母与数字）" />
      </div>
      <div class="form-group">
        <label>确认新密码</label>
        <input v-model="passwordForm.confirmPassword" type="password" class="form-input" placeholder="请再次输入新密码" />
      </div>
      <button class="btn btn-primary" @click="handleChangePassword" :disabled="changingPassword">
        {{ changingPassword ? '修改中...' : '修改密码' }}
      </button>
    </div>

    <!-- 忘记密码提示弹窗 -->
    <div v-if="showForgotModal" class="modal-overlay" @click.self="showForgotModal = false">
      <div class="modal modal-sm">
        <div class="modal-header"><h3>忘记密码</h3><button class="btn-close" @click="showForgotModal = false">&times;</button></div>
        <div class="modal-body">
          <p style="font-size:13px; line-height:1.8; color:#666;">
            忘记密码请联系上级管理员重置：<br><br>
            超级管理员可重置所有账号密码；<br>
            区域管理员可重置本区域管理员密码；<br>
            管理员可重置本区县操作员/查看者密码。<br><br>
            重置后首次登录将强制修改新密码。
          </p>
        </div>
        <div class="modal-footer"><button class="btn-confirm" @click="showForgotModal = false">知道了</button></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, reactive, computed } from 'vue';
import { getProfile, changePassword, updateProfile, type ProfileResult } from '@/api/auth';
import { getToken } from '@/utils/auth';
import { useRouter } from 'vue-router';

const router = useRouter();
const loading = ref(true);
const savingProfile = ref(false);
const changingPassword = ref(false);
const showForgotModal = ref(false);
const profile = ref<ProfileResult['data'] | null>(null);

const profileForm = reactive({ username: '', phone: '' });
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' });

const roleMap: Record<string, { label: string; level: number }> = {
  SUPER_ADMIN: { label: '超级管理员', level: 1 },
  REGION_ADMIN: { label: '区域管理员', level: 2 },
  ADMIN: { label: '管理员', level: 3 },
  OPERATOR: { label: '操作员', level: 4 },
  VIEWER: { label: '查看者', level: 5 },
};

const roleLabel = computed(() => profile.value ? roleMap[profile.value.roleType]?.label || profile.value.roleType : '');
const roleLevel = computed(() => profile.value ? roleMap[profile.value.roleType]?.level || 5 : 5);
const avatarChar = computed(() => profile.value?.username?.charAt(0) || '?');

function formatTime(time: string | null) {
  if (!time) return '无记录';
  return new Date(time).toLocaleString('zh-CN');
}

function showForgotTip() { showForgotModal.value = true; }

async function loadProfile() {
  loading.value = true;
  try {
    const res = await getProfile();
    profile.value = res.data;
    profileForm.username = res.data.username;
    profileForm.phone = res.data.phone || '';
  } catch { profile.value = null; }
  finally { loading.value = false; }
}

async function handleSaveProfile() {
  if (!profileForm.username.trim()) { alert('请输入姓名'); return; }
  savingProfile.value = true;
  try {
    await updateProfile({ username: profileForm.username.trim(), phone: profileForm.phone || undefined });
    alert('信息更新成功');
    await loadProfile();
  } catch (e: any) { alert(e.response?.data?.message || '更新失败'); }
  finally { savingProfile.value = false; }
}

async function handleChangePassword() {
  if (!passwordForm.oldPassword) { alert('请输入原密码'); return; }
  if (passwordForm.newPassword.length < 8) { alert('新密码至少8位'); return; }
  if (!/[A-Za-z]/.test(passwordForm.newPassword) || !/\d/.test(passwordForm.newPassword)) {
    alert('新密码需同时包含字母与数字');
    return;
  }
  if (passwordForm.newPassword !== passwordForm.confirmPassword) { alert('两次密码输入不一致'); return; }
  changingPassword.value = true;
  try {
    await changePassword(passwordForm.oldPassword, passwordForm.newPassword);
    alert('密码修改成功');
    passwordForm.oldPassword = '';
    passwordForm.newPassword = '';
    passwordForm.confirmPassword = '';
  } catch (e: any) { alert(e.response?.data?.message || '修改失败'); }
  finally { changingPassword.value = false; }
}

onMounted(() => {
  if (!getToken()) { router.push('/login'); return; }
  loadProfile();
});
</script>

<style scoped>
.profile-container { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; }
.page-header { margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #333; margin: 0; }

.profile-content { max-width: 600px; }

.user-header { display: flex; gap: 24px; margin-bottom: 32px; }
.avatar {
  width: 80px; height: 80px; border-radius: 50%; background: #1890ff;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-size: 28px; flex-shrink: 0;
}
.user-meta { display: flex; flex-direction: column; justify-content: center; }
.user-name { font-size: 18px; font-weight: 500; margin-bottom: 4px; }
.user-tags { display: flex; gap: 8px; align-items: center; }

.section-title { font-size: 16px; margin: 0 0 16px; color: #333; }

.form-group { margin-bottom: 16px; }
.form-group label { display: block; margin-bottom: 6px; font-size: 13px; color: #666; }
.form-input {
  width: 100%; padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px;
  font-size: 13px; box-sizing: border-box; background: #fff;
}
.form-input:disabled { background: #f5f5f5; color: #999; }
.form-input:focus { border-color: #1890ff; outline: none; }

.password-row { display: flex; gap: 8px; align-items: center; }
.password-row .form-input { flex: 1; }
.forgot-link { font-size: 12px; color: #1890ff; white-space: nowrap; cursor: pointer; text-decoration: none; }
.forgot-link:hover { text-decoration: underline; }

.divider { height: 1px; background: #e8e8e8; margin: 32px 0; }

.role-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; }
.role-1 { background: #fde8e8; color: #e74c3c; }
.role-2 { background: #fef3e2; color: #f39c12; }
.role-3 { background: #e8f5e9; color: #27ae60; }
.role-4 { background: #e3f2fd; color: #2196f3; }
.role-5 { background: #f3e5f5; color: #9c27b0; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }

.btn { padding: 8px 20px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; cursor: pointer; background: #fff; color: #333; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:hover { background: #096dd9; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

.loading { text-align: center; color: #999; padding: 40px; }

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; width: 420px; max-width: 90vw; overflow: hidden; }
.modal-sm { width: 360px; }
.modal-header { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { margin: 0; font-size: 16px; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.modal-body { padding: 24px; }
.modal-footer { padding: 12px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; }
.btn-confirm { padding: 8px 20px; background: #1890ff; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
</style>
