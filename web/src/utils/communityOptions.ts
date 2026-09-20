import { getProfileCache } from './auth';
import {
  getCommunities,
  getMyCommunities,
  getMapCommunityOptions,
  type CommunityOption,
} from '@/api/community';

/**
 * 按当前用户角色获取「社区下拉选项」。
 *
 * 背景：社区管理接口 /api/communities 仅对 超管/区域管理员/管理员 开放，
 * 操作员与查看者调用会得到 403，导致分光器列表页的社区下拉框空白、
 * 「所属社区」列全部显示为 '-'。
 *
 * 各角色的正确来源（与后端角色权限一致）：
 *   - 超级管理员 / 区域管理员 / 管理员：/api/communities（管理列表）
 *   - 操作员：/api/communities/my（自己被分配的社区）
 *   - 查看者：/api/communities/map-options（本区县有效社区，后端放行）
 */
export async function loadCommunityOptions(): Promise<CommunityOption[]> {
  const profile = getProfileCache();
  const role = profile?.roleType ?? 'VIEWER';

  try {
    if (role === 'SUPER_ADMIN' || role === 'REGION_ADMIN' || role === 'ADMIN') {
      const res = await getCommunities({ page: 1, pageSize: 500 });
      return res.data.list.map((c) => ({
        id: c.id,
        communityName: c.communityName,
        status: c.status,
        regionId: c.regionId ?? undefined,
      }));
    }

    if (role === 'OPERATOR') {
      const res = await getMyCommunities();
      return res.data.list ?? [];
    }

    // VIEWER 及其他角色
    const res = await getMapCommunityOptions();
    return res.data.list ?? [];
  } catch (e) {
    // 下拉选项属于辅助数据，失败不应阻断页面主流程
    console.error('加载社区下拉选项失败', e);
    return [];
  }
}
