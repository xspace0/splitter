<template>
  <div class="home-container">
    <div class="header">
      <h1>分光器资源管理系统</h1>
      <button class="btn-nav" @click="router.push('/communities')">社区管理</button>
      <button class="btn-nav" @click="router.push('/users')">用户管理</button>
      <button class="btn-logout" @click="handleLogout">退出登录</button>
    </div>
    <div class="content">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else-if="profile" class="profile-card">
        <h2>当前用户</h2>
        <div class="info-row">
          <span class="label">用户ID：</span>
          <span>{{ profile.id }}</span>
        </div>
        <div class="info-row">
          <span class="label">账号：</span>
          <span>{{ profile.account }}</span>
        </div>
        <div class="info-row">
          <span class="label">用户名：</span>
          <span>{{ profile.username }}</span>
        </div>
        <div class="info-row">
          <span class="label">角色：</span>
          <span class="role-tag">{{ formatRole(profile.roleType) }}</span>
        </div>
        <div class="info-row">
          <span class="label">实名认证：</span>
          <span>{{ profile.realNameVerified ? '已认证' : '未认证' }}</span>
        </div>
        <div class="info-row">
          <span class="label">手机号：</span>
          <span>{{ profile.phone || '未绑定' }}</span>
        </div>
        <div class="info-row">
          <span class="label">最后登录：</span>
          <span>{{ formatTime(profile.lastLoginTime) }}</span>
        </div>
      </div>
      <div v-else class="error">获取用户信息失败</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { getProfile, type ProfileResult } from '@/api/auth';
import { removeToken, getToken } from '@/utils/auth';

const router = useRouter();
const loading = ref(true);
const profile = ref<ProfileResult['data'] | null>(null);

const roleMap: Record<string, string> = {
  SUPER_ADMIN: '超级管理员',
  REGION_ADMIN: '区域管理员',
  ADMIN: '管理员',
  OPERATOR: '操作员',
  VIEWER: '查看者',
};

function formatRole(role: string) {
  return roleMap[role] || role;
}

function formatTime(time: string | null) {
  if (!time) return '未知';
  return new Date(time).toLocaleString('zh-CN');
}

async function loadProfile() {
  loading.value = true;
  try {
    const res = await getProfile();
    profile.value = res.data;
  } catch {
    profile.value = null;
  } finally {
    loading.value = false;
  }
}

function handleLogout() {
  removeToken();
  router.push('/login');
}

onMounted(() => {
  if (!getToken()) {
    router.push('/login');
    return;
  }
  loadProfile();
});
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background: #f5f6fa;
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  height: 56px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
.header h1 {
  font-size: 18px;
  color: #333;
  margin: 0;
}
.btn-nav {
  padding: 6px 16px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-nav:hover {
  background: #5a6fc7;
}
.btn-logout {
  padding: 6px 16px;
  background: #e74c3c;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}
.btn-logout:hover {
  background: #c0392b;
}
.content {
  max-width: 640px;
  margin: 24px auto;
  padding: 0 16px;
}
.loading {
  text-align: center;
  color: #999;
  padding: 40px;
}
.profile-card {
  background: #fff;
  border-radius: 12px;
  padding: 32px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}
.profile-card h2 {
  margin: 0 0 24px;
  font-size: 18px;
  color: #333;
}
.info-row {
  display: flex;
  align-items: center;
  padding: 10px 0;
  border-bottom: 1px solid #f0f0f0;
  font-size: 14px;
}
.label {
  width: 100px;
  color: #888;
}
.role-tag {
  display: inline-block;
  padding: 2px 10px;
  background: #667eea;
  color: #fff;
  border-radius: 4px;
  font-size: 12px;
}
.error {
  text-align: center;
  color: #e74c3c;
  padding: 40px;
}
</style>
