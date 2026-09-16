<template>
  <div class="logs-container">
    <div class="page-header">
      <h2>操作日志</h2>
    </div>

    <div class="search-bar">
      <select v-model="filterOpType" @change="loadLogs" class="select">
        <option value="">全部操作类型</option>
        <option v-for="op in operationTypes" :key="op.value" :value="op.value">{{ op.label }}</option>
      </select>
      <select v-model="filterTargetType" @change="loadLogs" class="select">
        <option value="">全部对象类型</option>
        <option v-for="t in targetTypes" :key="t" :value="t">{{ t }}</option>
      </select>
      <input v-model="filterStartDate" type="date" class="input date-input" />
      <span class="date-sep">至</span>
      <input v-model="filterEndDate" type="date" class="input date-input" />
      <button class="btn btn-primary btn-sm" @click="loadLogs">查询</button>
      <button class="btn btn-sm" @click="resetFilters">重置</button>
    </div>

    <table class="data-table">
      <thead>
        <tr>
          <th>时间</th><th>操作人</th><th>操作类型</th><th>对象类型</th>
          <th>对象名称</th><th>IP</th><th>操作内容</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="item in logs" :key="item.id">
          <td>{{ formatTime(item.createTime) }}</td>
          <td>{{ item.username }}</td>
          <td><span class="tag" :class="opTagClass(item.operationType)">{{ opLabel(item.operationType) }}</span></td>
          <td>{{ item.targetType || '-' }}</td>
          <td>{{ item.targetId || '-' }}</td>
          <td>{{ item.ip || '-' }}</td>
          <td class="content-cell">{{ item.operationContent || '-' }}</td>
        </tr>
        <tr v-if="logs.length === 0"><td colspan="7" class="empty-row">暂无数据</td></tr>
      </tbody>
    </table>

    <div class="pagination">
      <span>共 {{ total }} 条</span>
      <button class="page-item" :disabled="page <= 1" @click="page--; loadLogs()">‹</button>
      <span class="page-item active">{{ page }}</span>
      <button class="page-item" :disabled="page * pageSize >= total" @click="page++; loadLogs()">›</button>
    </div>

    <div class="tip-box danger">
      🔒 操作日志为只追加表，不可修改、不可删除，日志至少保存5年。仅超级管理员可查询。行政区划操作不走业务操作日志。
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { getLogs, type LogItem } from '@/api/log';

const logs = ref<LogItem[]>([]);
const total = ref(0);
const page = ref(1);
const pageSize = 20;

const filterOpType = ref('');
const filterTargetType = ref('');
const filterStartDate = ref('');
const filterEndDate = ref('');

const operationTypes = [
  { value: 'LOGIN', label: '登录' },
  { value: 'LOGOUT', label: '登出' },
  { value: 'CREATE', label: '新增' },
  { value: 'UPDATE', label: '修改' },
  { value: 'DELETE', label: '删除' },
  { value: 'ASSIGN_PERMISSION', label: '权限分配' },
  { value: 'REMOVE_PERMISSION', label: '权限移除' },
  { value: 'ROLE_CHANGE', label: '角色变更' },
  { value: 'FAULT_REPORT', label: '故障上报' },
  { value: 'FAULT_RECOVER', label: '故障恢复' },
  { value: 'DISABLE', label: '停用' },
  { value: 'ENABLE', label: '恢复启用' },
];

const targetTypes = ['用户', '社区', '分光器', '权限'];

const opLabelMap: Record<string, string> = {
  LOGIN: '登录', LOGOUT: '登出', CREATE: '新增', UPDATE: '修改', DELETE: '删除',
  ASSIGN_PERMISSION: '权限分配', REMOVE_PERMISSION: '权限移除', ROLE_CHANGE: '角色变更',
  FAULT_REPORT: '故障上报', FAULT_RECOVER: '故障恢复', DISABLE: '停用', ENABLE: '恢复启用',
};

function opLabel(type: string) {
  return opLabelMap[type] || type;
}

function opTagClass(type: string) {
  const map: Record<string, string> = {
    LOGIN: 'tag-blue', LOGOUT: 'tag-gray',
    CREATE: 'tag-green', UPDATE: 'tag-blue', DELETE: 'tag-red',
    ASSIGN_PERMISSION: 'tag-purple', REMOVE_PERMISSION: 'tag-orange',
    ROLE_CHANGE: 'tag-blue', FAULT_REPORT: 'tag-red', FAULT_RECOVER: 'tag-green',
    DISABLE: 'tag-orange', ENABLE: 'tag-green',
  };
  return map[type] || 'tag-gray';
}

function formatTime(t: string) {
  return new Date(t).toLocaleString('zh-CN');
}

function resetFilters() {
  filterOpType.value = '';
  filterTargetType.value = '';
  filterStartDate.value = '';
  filterEndDate.value = '';
  page.value = 1;
  loadLogs();
}

async function loadLogs() {
  try {
    const params: Record<string, unknown> = { page: page.value, pageSize };
    if (filterOpType.value) params.operationType = filterOpType.value;
    if (filterTargetType.value) params.targetType = filterTargetType.value;
    if (filterStartDate.value) params.startDate = filterStartDate.value;
    if (filterEndDate.value) params.endDate = filterEndDate.value;
    const res = await getLogs(params as Parameters<typeof getLogs>[0]);
    logs.value = res.data.list;
    total.value = res.data.total;
  } catch (e) {
    console.error('加载日志失败', e);
    logs.value = [];
  }
}

onMounted(() => { loadLogs(); });
</script>

<style scoped>
.logs-container {
  min-height: 100vh;
  background: #f0f2f5;
  padding: 20px 24px;
}
.page-header { margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #333; margin: 0; }

.search-bar { display: flex; gap: 8px; margin-bottom: 16px; align-items: center; flex-wrap: wrap; }
.select { padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; min-width: 140px; }
.input { padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; }
.date-input { width: 150px; }
.date-sep { font-size: 13px; color: #999; }
.btn { padding: 6px 16px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; cursor: pointer; background: #fff; color: #333; }
.btn:hover { border-color: #1890ff; color: #1890ff; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:hover { background: #096dd9; }
.btn-sm { padding: 4px 12px; font-size: 12px; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
.data-table th { background: #fafafa; padding: 12px; text-align: left; border-bottom: 1px solid #f0f0f0; color: #666; font-weight: 500; }
.data-table td { padding: 12px; border-bottom: 1px solid #f0f0f0; }
.data-table tr:hover td { background: #f5f5f5; }
.empty-row { text-align: center; color: #999; padding: 40px; }
.content-cell { font-size: 12px; color: #999; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-red { background: #fff1f0; color: #ff4d4f; border-color: #ffa39e; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }
.tag-blue { background: #e6f7ff; color: #1890ff; border-color: #91d5ff; }
.tag-purple { background: #f9f0ff; color: #722ed1; border-color: #d3adf7; }
.tag-gray { background: #fafafa; color: #999; border-color: #d9d9d9; }

.pagination { display: flex; align-items: center; gap: 4px; margin-top: 16px; justify-content: flex-end; }
.pagination span { font-size: 13px; color: #666; margin-right: 8px; }
.page-item { min-width: 32px; height: 32px; border: 1px solid #d9d9d9; border-radius: 4px; background: #fff; cursor: pointer; font-size: 13px; display: flex; align-items: center; justify-content: center; }
.page-item.active { background: #1890ff; color: #fff; border-color: #1890ff; }
.page-item:disabled { opacity: 0.4; cursor: not-allowed; }

.tip-box { margin-top: 12px; padding: 8px 12px; border-radius: 4px; font-size: 12px; }
.tip-box.danger { background: #fff2f0; color: #ff4d4f; }
</style>
