<template>
  <div class="layout-container">
    <!-- 侧边栏 -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <h1>分光器资源管理系统</h1>
      </div>
      <nav class="sidebar-nav">
        <div class="menu-group">业务管理</div>
        <RouterLink to="/" class="menu-item" active-class="active" :class="{ active: route.path === '/' }">
          <span class="menu-icon">🏠</span> 概览
        </RouterLink>
        <RouterLink to="/splitters" class="menu-item" active-class="active">
          <span class="menu-icon">📊</span> 分光器列表
        </RouterLink>
        <RouterLink to="/map" class="menu-item" active-class="active">
          <span class="menu-icon">🗺️</span> 地图查看
        </RouterLink>
        <div class="menu-group">系统管理</div>
        <RouterLink to="/communities" class="menu-item" active-class="active">
          <span class="menu-icon">🏘️</span> 社区管理
        </RouterLink>
        <RouterLink to="/users" class="menu-item" active-class="active">
          <span class="menu-icon">👥</span> 用户管理
        </RouterLink>
        <RouterLink to="/permissions" class="menu-item" active-class="active">
          <span class="menu-icon">🔐</span> 权限分配
        </RouterLink>
        <RouterLink to="/logs" class="menu-item" active-class="active">
          <span class="menu-icon">📋</span> 操作日志
        </RouterLink>
        <RouterLink to="/regions" class="menu-item" active-class="active">
          <span class="menu-icon">🗺️</span> 行政区划
        </RouterLink>
        <div class="menu-group">个人</div>
        <RouterLink to="/profile" class="menu-item" active-class="active">
          <span class="menu-icon">👤</span> 个人中心
        </RouterLink>
      </nav>
      <div class="sidebar-footer">
        <div class="user-info">
          <span class="role-tag" :class="'role-' + roleLevel">{{ roleLabel }}</span>
          <span class="user-account">{{ account }}</span>
        </div>
        <button class="btn-logout" @click="handleLogout">退出登录</button>
      </div>
    </aside>

    <!-- 主内容区 -->
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter, RouterLink, RouterView } from 'vue-router';
import { getProfile, type ProfileResult } from '@/api/auth';
import { removeToken, getToken } from '@/utils/auth';

const route = useRoute();
const router = useRouter();
const profile = ref<ProfileResult['data'] | null>(null);

const roleMap: Record<string, { label: string; level: number }> = {
  SUPER_ADMIN: { label: '超级管理员', level: 1 },
  REGION_ADMIN: { label: '区域管理员', level: 2 },
  ADMIN: { label: '管理员', level: 3 },
  OPERATOR: { label: '操作员', level: 4 },
  VIEWER: { label: '查看者', level: 5 },
};

const roleLabel = computed(() => {
  if (!profile.value) return '';
  return roleMap[profile.value.roleType]?.label || profile.value.roleType;
});

const roleLevel = computed(() => {
  if (!profile.value) return 5;
  return roleMap[profile.value.roleType]?.level || 5;
});

const account = computed(() => profile.value?.account || '');

async function loadProfile() {
  try {
    const res = await getProfile();
    profile.value = res.data;
  } catch {
    profile.value = null;
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
.layout-container {
  display: flex;
  min-height: 100vh;
  background: #f0f2f5;
}

.sidebar {
  width: 220px;
  background: #001529;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  position: fixed;
  top: 0;
  left: 0;
  bottom: 0;
  z-index: 1000;
}

.sidebar-header {
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.sidebar-header h1 {
  font-size: 15px;
  color: #fff;
  font-weight: 500;
  margin: 0;
  line-height: 1.4;
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.menu-group {
  padding: 12px 24px 4px;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 24px;
  color: rgba(255, 255, 255, 0.65);
  font-size: 13px;
  cursor: pointer;
  border-left: 3px solid transparent;
  text-decoration: none;
  transition: all 0.2s;
}

.menu-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.06);
}

.menu-item.active {
  background: #1890ff;
  color: #fff;
  border-left-color: #fff;
}

.menu-icon {
  font-size: 14px;
  width: 18px;
  text-align: center;
}

.sidebar-footer {
  padding: 12px 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.45);
}

.role-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  white-space: nowrap;
}

.role-1 { background: #fde8e8; color: #e74c3c; }
.role-2 { background: #fef3e2; color: #f39c12; }
.role-3 { background: #e8f5e9; color: #27ae60; }
.role-4 { background: #e3f2fd; color: #2196f3; }
.role-5 { background: #f3e5f5; color: #9c27b0; }

.user-account {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-logout {
  width: 100%;
  padding: 6px;
  background: transparent;
  color: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-logout:hover {
  color: #ff4d4f;
  border-color: #ff4d4f;
}

.main-content {
  flex: 1;
  margin-left: 220px;
  min-height: 100vh;
  overflow-x: auto;
}
</style>
