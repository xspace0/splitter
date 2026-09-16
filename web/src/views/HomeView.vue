<template>
  <div class="home-container">
    <div class="page-header">
      <h2>概览</h2>
    </div>
    <div v-if="loading" class="loading">加载中...</div>
    <div v-else>
      <!-- 统计卡片 - 设备状态 -->
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-title">设备总数</div><div class="stat-value">--</div></div>
        <div class="stat-card"><div class="stat-title">正常</div><div class="stat-value green">--</div></div>
        <div class="stat-card"><div class="stat-title">故障</div><div class="stat-value red">--</div></div>
        <div class="stat-card"><div class="stat-title">停用</div><div class="stat-value orange">--</div></div>
        <div class="stat-card"><div class="stat-title">建设中</div><div class="stat-value amber">--</div></div>
      </div>
      <!-- 统计卡片 - 社区/用户 -->
      <div class="stat-cards">
        <div class="stat-card"><div class="stat-title">社区总数</div><div class="stat-value purple">--</div></div>
        <div class="stat-card"><div class="stat-title">停用社区</div><div class="stat-value orange">--</div></div>
        <div class="stat-card"><div class="stat-title">系统用户</div><div class="stat-value cyan">--</div></div>
        <div class="stat-card"><div class="stat-title">待实名认证</div><div class="stat-value warning">--</div></div>
      </div>

      <!-- 图表区 -->
      <div class="chart-row">
        <!-- 设备级别分布 -->
        <div class="chart-card">
          <h3>设备级别分布</h3>
          <div class="bar-chart">
            <div class="bar-item" v-for="item in levelDistribution" :key="item.label">
              <div class="bar-label">
                <span>{{ item.label }}</span>
                <span :style="{ color: item.color }">{{ item.count }} 台</span>
              </div>
              <div class="bar-track">
                <div class="bar-fill" :style="{ width: item.percent + '%', background: item.color }"></div>
              </div>
            </div>
          </div>
        </div>
        <!-- 设备状态占比 -->
        <div class="chart-card">
          <h3>设备状态占比</h3>
          <div class="donut-container">
            <div class="donut-chart">
              <div class="donut-center">
                <span class="donut-total">--</span>
                <span class="donut-label">总数</span>
              </div>
            </div>
          </div>
          <div class="donut-legend">
            <span><span class="dot green"></span>正常 --</span>
            <span><span class="dot red"></span>故障 --</span>
            <span><span class="dot orange"></span>停用 --</span>
            <span><span class="dot amber"></span>建设中 --</span>
          </div>
        </div>
      </div>

      <!-- 最近故障设备 -->
      <div class="table-card">
        <div class="card-header">
          <h3>最近故障设备</h3>
          <span class="link-text">查看全部 ›</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>设备名称</th><th>所属社区</th><th>设备级别</th>
              <th>故障类型</th><th>故障时间</th><th>状态</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="6" class="empty-row">暂无故障设备</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 社区设备统计 -->
      <div class="table-card">
        <div class="card-header">
          <h3>社区设备统计</h3>
          <span class="link-text">查看全部 ›</span>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>社区名称</th><th>所属区县</th><th>光交</th><th>一级</th>
              <th>二级</th><th>成端</th><th>设备总数</th><th>故障数</th><th>社区状态</th>
            </tr>
          </thead>
          <tbody>
            <tr><td colspan="9" class="empty-row">暂无数据</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 个人信息 -->
      <div v-if="profile" class="profile-card">
        <h3>当前用户</h3>
        <div class="info-grid">
          <div class="info-item"><span class="info-label">账号</span><span class="info-value">{{ profile.account }}</span></div>
          <div class="info-item"><span class="info-label">用户名</span><span class="info-value">{{ profile.username }}</span></div>
          <div class="info-item"><span class="info-label">角色</span><span class="role-tag" :class="'role-' + roleLevel">{{ roleLabel }}</span></div>
          <div class="info-item"><span class="info-label">实名认证</span><span class="info-value">{{ profile.realNameVerified ? '已认证' : '未认证' }}</span></div>
          <div class="info-item"><span class="info-label">手机号</span><span class="info-value">{{ profile.phone || '未绑定' }}</span></div>
          <div class="info-item"><span class="info-label">最后登录</span><span class="info-value">{{ formatTime(profile.lastLoginTime) }}</span></div>
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

const roleLabel = computed(() => profile.value ? roleMap[profile.value.roleType]?.label || profile.value.roleType : '');
const roleLevel = computed(() => profile.value ? roleMap[profile.value.roleType]?.level || 5 : 5);

const levelDistribution = ref([
  { label: '光交（级别1）', count: 0, percent: 0, color: '#e74c3c' },
  { label: '一级分光器（级别2）', count: 0, percent: 0, color: '#f39c12' },
  { label: '二级分光器（级别3）', count: 0, percent: 0, color: '#3498db' },
  { label: '光缆成端（级别4）', count: 0, percent: 0, color: '#27ae60' },
]);

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
  if (!getToken()) { router.push('/login'); return; }
  loadProfile();
});
</script>

<style scoped>
.home-container { padding: 20px 24px; }
.page-header { margin-bottom: 20px; }
.page-header h2 { margin: 0; font-size: 18px; color: #333; }

.stat-cards { display: flex; gap: 16px; margin-bottom: 20px; }
.stat-card {
  flex: 1; background: #fff; border-radius: 8px; padding: 20px;
  border: 1px solid #f0f0f0;
}
.stat-title { font-size: 13px; color: #999; margin-bottom: 8px; }
.stat-value { font-size: 28px; font-weight: 600; color: #1890ff; }
.stat-value.green { color: #52c41a; }
.stat-value.red { color: #ff4d4f; }
.stat-value.orange { color: #fa8c16; }
.stat-value.amber { color: #d48806; }
.stat-value.purple { color: #722ed1; }
.stat-value.cyan { color: #13c2c2; }
.stat-value.warning { color: #faad14; }

.chart-row { display: flex; gap: 16px; margin-bottom: 20px; }
.chart-card {
  flex: 1; background: #fff; border: 1px solid #f0f0f0;
  border-radius: 8px; padding: 20px;
}
.chart-card h3 { font-size: 14px; margin: 0 0 16px; color: #333; }

.bar-chart { display: flex; flex-direction: column; gap: 14px; }
.bar-item {}
.bar-label { display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 4px; }
.bar-track { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
.bar-fill { height: 100%; border-radius: 4px; transition: width 0.3s; }

.donut-container { display: flex; align-items: center; justify-content: center; height: 160px; }
.donut-chart {
  position: relative; width: 140px; height: 140px; border-radius: 50%;
  background: conic-gradient(#f0f0f0 0% 100%);
}
.donut-center {
  position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
  width: 90px; height: 90px; background: #fff; border-radius: 50%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
}
.donut-total { font-size: 24px; font-weight: 600; color: #1890ff; }
.donut-label { font-size: 11px; color: #999; }
.donut-legend { display: flex; justify-content: center; gap: 20px; margin-top: 12px; font-size: 12px; }
.dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 4px; }
.dot.green { background: #52c41a; }
.dot.red { background: #ff4d4f; }
.dot.orange { background: #fa8c16; }
.dot.amber { background: #d48806; }

.table-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.card-header h3 { font-size: 14px; margin: 0; color: #333; }
.link-text { font-size: 12px; color: #1890ff; cursor: pointer; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { background: #fafafa; padding: 10px; text-align: left; border-bottom: 1px solid #f0f0f0; color: #666; font-weight: 500; }
.data-table td { padding: 10px; border-bottom: 1px solid #f0f0f0; }
.empty-row { text-align: center; color: #999; padding: 24px; }

.profile-card { background: #fff; border: 1px solid #f0f0f0; border-radius: 8px; padding: 24px; }
.profile-card h3 { margin: 0 0 20px; font-size: 15px; color: #333; }
.info-grid { display: flex; flex-wrap: wrap; gap: 16px 40px; }
.info-item { display: flex; flex-direction: column; gap: 4px; }
.info-label { font-size: 12px; color: #999; }
.info-value { font-size: 14px; color: #333; }
.role-tag { display: inline-block; padding: 2px 10px; border-radius: 10px; font-size: 12px; width: fit-content; }
.role-1 { background: #fde8e8; color: #e74c3c; }
.role-2 { background: #fef3e2; color: #f39c12; }
.role-3 { background: #e8f5e9; color: #27ae60; }
.role-4 { background: #e3f2fd; color: #2196f3; }
.role-5 { background: #f3e5f5; color: #9c27b0; }

.loading { text-align: center; color: #999; padding: 40px; }
</style>
