<template>
  <div class="permission-container">
    <div class="page-header">
      <h2>权限分配</h2>
    </div>

    <div class="split-layout">
      <!-- 左侧操作员列表 -->
      <div class="left-panel">
        <div class="panel-header">操作员列表</div>
        <div class="panel-body">
          <input v-model="operatorSearch" placeholder="搜索操作员" class="search-input" @keyup="filterOperators" />
          <div v-for="u in filteredOperators" :key="u.id" class="mini-list-item" :class="{ active: selectedUserId === u.id }" @click="selectUser(u)">
            <div>
              <div class="op-name">{{ u.username }}</div>
              <div class="op-sub">{{ u.regionId || '-' }} · 已分配0个社区</div>
            </div>
            <span class="tag" :class="u.status === 1 ? 'tag-green' : 'tag-gray'">{{ u.status === 1 ? '启用' : '禁用' }}</span>
          </div>
          <div v-if="filteredOperators.length === 0" class="empty-tip">暂无操作员</div>
        </div>
      </div>

      <!-- 右侧社区分配 -->
      <div class="right-panel">
        <div class="panel-header">
          <span>{{ selectedUser ? selectedUser.username + ' - 社区权限分配' : '请选择操作员' }}</span>
          <button v-if="selectedUser" class="btn btn-primary btn-sm" @click="showAssignModal = true">+ 分配社区</button>
        </div>
        <div class="panel-body">
          <div v-if="!selectedUserId" class="empty-tip">请从左侧选择操作员</div>
          <div v-else-if="loadingDetail" class="empty-tip">加载中...</div>
          <template v-else>
            <table class="data-table">
              <thead>
                <tr><th>社区名称</th><th>所属区县</th><th>分光器数</th><th>社区状态</th><th>分配时间</th><th>操作</th></tr>
              </thead>
              <tbody>
                <tr v-for="c in userCommunities" :key="c.assignmentId">
                  <td>{{ c.community?.communityName || '-' }}</td>
                  <td>{{ getRegionName(c.community?.regionId) }}</td>
                  <td>{{ c.community ? getSplitterCount(c.community.id) : '-' }}</td>
                  <td>
                    <span class="tag" :class="c.community?.status === 1 ? 'tag-green' : 'tag-orange'">
                      {{ c.community?.status === 1 ? '正常' : '停用' }}
                    </span>
                  </td>
                  <td>{{ formatTime(c.createTime) }}</td>
                  <td><button class="btn btn-sm btn-danger" @click="handleRemove(c)">移除权限</button></td>
                </tr>
                <tr v-if="userCommunities.length === 0"><td colspan="6" class="empty-row">暂未分配社区</td></tr>
              </tbody>
            </table>
          </template>
        </div>
      </div>
    </div>

    <!-- 分配社区弹窗 -->
    <div v-if="showAssignModal" class="modal-overlay" @click.self="showAssignModal = false">
      <div class="modal">
        <div class="modal-header">
          <h3>分配社区</h3>
          <button class="btn-close" @click="showAssignModal = false">&times;</button>
        </div>
        <div class="modal-body">
          <input v-model="assignSearch" placeholder="搜索未分配社区" class="form-input" style="width:240px; margin-bottom:12px;" />
          <table class="data-table" style="font-size:13px;">
            <thead>
              <tr><th style="width:40px;">选择</th><th>社区名称</th><th>所属区县</th><th>社区状态</th><th>当前分配</th></tr>
            </thead>
            <tbody>
              <tr v-for="c in availableCommunities" :key="c.id">
                <td><input type="checkbox" :value="c.id" v-model="selectedCommunityIds" :disabled="c.status !== 1" /></td>
                <td>{{ c.communityName }}</td>
                <td>{{ getRegionName(c.regionId?.toString()) }}</td>
                <td><span class="tag" :class="c.status === 1 ? 'tag-green' : 'tag-orange'">{{ c.status === 1 ? '正常' : '停用' }}</span></td>
                <td style="color:#999; font-size:12px;">{{ isAlreadyAssigned(c.id) ? '已分配' : '未分配' }}</td>
              </tr>
              <tr v-if="availableCommunities.length === 0"><td colspan="5" class="empty-row">暂无可分配社区</td></tr>
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showAssignModal = false">取消</button>
          <button class="btn-confirm" @click="handleAssign" :disabled="submitting">{{ submitting ? '提交中...' : '确定分配' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { getCommunities, type CommunityItem } from '@/api/community';
import { getUserCommunities, assignPermission, removePermission, type UserCommunitiesResult } from '@/api/permission';
import { getUsers, type UserItem } from '@/api/user';

const operators = ref<UserItem[]>([]);
const filteredOperators = ref<UserItem[]>([]);
const operatorSearch = ref('');
const selectedUserId = ref('');
const selectedUser = ref<UserItem | null>(null);
const userCommunities = ref<UserCommunitiesResult['data']['communities']>([]);
const loadingDetail = ref(false);
const communities = ref<CommunityItem[]>([]);
const showAssignModal = ref(false);
const submitting = ref(false);
const assignSearch = ref('');
const selectedCommunityIds = ref<string[]>([]);

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: '超级管理员', REGION_ADMIN: '区域管理员', ADMIN: '管理员', OPERATOR: '操作员', VIEWER: '查看者',
};

function formatTime(t: string) { return new Date(t).toLocaleDateString('zh-CN'); }

function getRegionName(regionId: string | undefined) {
  if (!regionId) return '-';
  return regionId;
}

function getSplitterCount(_communityId: string) {
  return '-';
}

function isAlreadyAssigned(communityId: string) {
  return userCommunities.value.some((c) => c.community?.id === communityId);
}

function filterOperators() {
  if (!operatorSearch.value) { filteredOperators.value = operators.value; return; }
  const kw = operatorSearch.value.toLowerCase();
  filteredOperators.value = operators.value.filter(
    (u) => u.username.toLowerCase().includes(kw) || u.account.toLowerCase().includes(kw),
  );
}

const availableCommunities = computed(() => {
  let list = communities.value;
  if (assignSearch.value) {
    const kw = assignSearch.value.toLowerCase();
    list = list.filter((c) => c.communityName.toLowerCase().includes(kw));
  }
  return list;
});

async function selectUser(u: UserItem) {
  selectedUserId.value = u.id;
  selectedUser.value = u;
  loadingDetail.value = true;
  try {
    const res = await getUserCommunities(u.id);
    userCommunities.value = res.data.communities;
  } catch { userCommunities.value = []; }
  finally { loadingDetail.value = false; }
}

async function handleAssign() {
  if (selectedCommunityIds.value.length === 0) { alert('请至少选择一个社区'); return; }
  submitting.value = true;
  try {
    await assignPermission({ userId: selectedUserId.value, communityIds: selectedCommunityIds.value });
    showAssignModal.value = false;
    selectedCommunityIds.value = [];
    selectUser(selectedUser.value!);
  } catch (e: any) { alert(e.response?.data?.message || '分配失败'); }
  finally { submitting.value = false; }
}

async function handleRemove(c: UserCommunitiesResult['data']['communities'][0]) {
  if (!confirm(`确定移除${selectedUser.value?.username}对社区${c.community?.communityName}的权限吗？`)) return;
  try {
    await removePermission({ userId: selectedUserId.value, communityIds: [c.community!.id] });
    if (selectedUser.value) selectUser(selectedUser.value);
  } catch (e: any) { alert(e.response?.data?.message || '移除失败'); }
}

onMounted(async () => {
  try {
    const [usersRes, commRes] = await Promise.all([
      getUsers({ page: 1, pageSize: 100 }),
      getCommunities({ page: 1, pageSize: 100 }),
    ]);
    operators.value = usersRes.data.list.filter(
      (u) => u.roleType === 'OPERATOR' || u.roleType === 'VIEWER',
    );
    filteredOperators.value = operators.value;
    communities.value = commRes.data.list;
  } catch (e) { console.error('加载数据失败', e); }
});
</script>

<style scoped>
.permission-container { min-height: 100vh; background: #f0f2f5; padding: 20px 24px; }
.page-header { margin-bottom: 16px; }
.page-header h2 { font-size: 18px; color: #333; margin: 0; }

.split-layout { display: flex; gap: 20px; min-height: 520px; }
.left-panel { width: 280px; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; background: #fff; }
.right-panel { flex: 1; border: 1px solid #f0f0f0; border-radius: 8px; overflow: hidden; background: #fff; display: flex; flex-direction: column; }
.panel-header { padding: 12px 16px; background: #fafafa; border-bottom: 1px solid #f0f0f0; font-size: 14px; font-weight: 500; display: flex; justify-content: space-between; align-items: center; }
.panel-body { padding: 8px; flex: 1; overflow-y: auto; }

.search-input { width: 100%; padding: 6px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; margin-bottom: 8px; box-sizing: border-box; }

.mini-list-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-radius: 4px; cursor: pointer; border: 1px solid transparent; }
.mini-list-item:hover { background: #f5f5f5; }
.mini-list-item.active { background: #e6f7ff; border-color: #91d5ff; }
.op-name { font-weight: 500; font-size: 13px; }
.op-sub { font-size: 12px; color: #999; margin-top: 2px; }

.tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; border: 1px solid transparent; }
.tag-green { background: #f6ffed; color: #52c41a; border-color: #b7eb8f; }
.tag-gray { background: #fafafa; color: #999; border-color: #d9d9d9; }
.tag-orange { background: #fff7e6; color: #fa8c16; border-color: #ffd591; }

.data-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.data-table th { background: #fafafa; padding: 10px; text-align: left; border-bottom: 1px solid #f0f0f0; color: #666; font-weight: 500; }
.data-table td { padding: 10px; border-bottom: 1px solid #f0f0f0; }
.empty-row { text-align: center; color: #999; padding: 24px; }

.btn { padding: 6px 16px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; cursor: pointer; background: #fff; color: #333; }
.btn:hover { border-color: #1890ff; color: #1890ff; }
.btn-primary { background: #1890ff; color: #fff; border-color: #1890ff; }
.btn-primary:hover { background: #096dd9; }
.btn-sm { padding: 4px 12px; font-size: 12px; }
.btn-danger { color: #ff4d4f; border-color: #ff4d4f; }
.btn-danger:hover { background: #fff1f0; }

.empty-tip { text-align: center; color: #999; padding: 40px; }

.modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #fff; border-radius: 8px; width: 560px; max-width: 90%; max-height: 80vh; overflow-y: auto; }
.modal-header { padding: 16px 24px; border-bottom: 1px solid #f0f0f0; display: flex; justify-content: space-between; align-items: center; }
.modal-header h3 { font-size: 16px; margin: 0; }
.btn-close { background: none; border: none; font-size: 20px; cursor: pointer; color: #999; }
.modal-body { padding: 24px; }
.modal-footer { padding: 12px 24px; border-top: 1px solid #f0f0f0; display: flex; justify-content: flex-end; gap: 8px; }
.form-input { padding: 8px 12px; border: 1px solid #d9d9d9; border-radius: 4px; font-size: 13px; box-sizing: border-box; }
.btn-cancel { padding: 8px 20px; background: #f5f5f5; color: #666; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm { padding: 8px 20px; background: #1890ff; color: #fff; border: none; border-radius: 4px; font-size: 13px; cursor: pointer; }
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
