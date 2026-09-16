<template>
  <div class="home-container">
    <div class="page-header">
      <h2>概览</h2>
    </div>
    <div class="page-body">
      <div v-if="loading" class="loading">加载中...</div>
      <div v-else>
        <!-- 统计卡片 -->
        <div class="stat-cards">
          <div class="stat-card">
            <div class="stat-title">设备总数</div>
            <div class="stat-value">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">正常</div>
            <div class="stat-value green">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">故障</div>
            <div class="stat-value red">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">停用</div>
            <div class="stat-value orange">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">建设中</div>
            <div class="stat-value amber">--</div>
          </div>
        </div>
        <div class="stat-cards">
          <div class="stat-card">
            <div class="stat-title">社区总数</div>
            <div class="stat-value purple">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">停用社区</div>
            <div class="stat-value orange">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">系统用户</div>
            <div class="stat-value cyan">--</div>
          </div>
          <div class="stat-card">
            <div class="stat-title">待实名认证</div>
            <div class="stat-value warning">--</div>
          </div>
        </div>

        <!-- 个人信息卡片 -->
        <div v-if="profile" class="profile-card">
          <h3>当前用户</h3>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">账号</span>
              <span class="info-value">{{ profile.account }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">用户名</span>
              <span class="info-value">{{ profile.username }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">角色</span>
              <span class="role-tag" :class="'role-' + roleLevel">{{ roleLabel }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">实名认证</span>
              <span class="info-value">{{ profile.realNameVerified ? '已认证' : '未认证' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">手机号</span>
              <span class="info-value">{{ profile.phone || '未绑定' }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">最后登录</span>
              <span class="info-value">{{ formatTime(profile.lastLoginTime) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { getProfile, type ProfileResult } from '@/api/auth';
import { getToken } from '@/utils/auth';
import { useRouter } from 'vue-router';

const router = useRouter();
const loading = ref(true);
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
  padding: 20px 24px;
}

.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.page-body {
  max-width: 1100px;
}

.stat-cards {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
}

.stat-card {
  flex: 1;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #f0f0f0;
}

.stat-title {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #1890ff;
}

.stat-value.green { color: #52c41a; }
.stat-value.red { color: #ff4d4f; }
.stat-value.orange { color: #fa8c16; }
.stat-value.amber { color: #d48806; }
.stat-value.purple { color: #722ed1; }
.stat-value.cyan { color: #13c2c2; }
.stat-value.warning { color: #faad14; }

.profile-card {
  background: #fff;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #f0f0f0;
}

.profile-card h3 {
  margin: 0 0 20px;
  font-size: 15px;
  color: #333;
}

.info-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px 40px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 12px;
  color: #999;
}

.info-value {
  font-size: 14px;
  color: #333;
}

.role-tag {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 12px;
  width: fit-content;
}

.role-1 { background: #fde8e8; color: #e74c3c; }
.role-2 { background: #fef3e2; color: #f39c12; }
.role-3 { background: #e8f5e9; color: #27ae60; }
.role-4 { background: #e3f2fd; color: #2196f3; }
.role-5 { background: #f3e5f5; color: #9c27b0; }

.loading {
  text-align: center;
  color: #999;
  padding: 40px;
}
</style>
