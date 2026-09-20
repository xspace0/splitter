import request from '@/utils/request';

export interface AssignmentItem {
  id: string;
  userId: string;
  username: string;
  account: string;
  roleType: string;
  communityId: string;
  communityName: string;
  status: number;
  createTime: string;
  updateTime: string;
}

export interface UserCommunitiesResult {
  code: number;
  data: {
    user: {
      id: string;
      username: string;
      account: string;
      roleType: string;
      regionId: string | null;
    };
    communities: {
      assignmentId: string;
      status: number;
      community: {
        id: string;
        communityName: string;
        regionId: string;
        status: number;
      } | null;
      createTime: string;
      updateTime: string;
    }[];
  };
}

export interface CommunityUsersResult {
  code: number;
  data: {
    community: { id: string; communityName: string; status: number };
    users: {
      assignmentId: string;
      status: number;
      user: {
        id: string;
        username: string;
        account: string;
        roleType: string;
        phone: string | null;
        realNameVerified: number;
      } | null;
      createTime: string;
    }[];
  };
}

export function getAssignments(params: { userId?: string; communityId?: string }) {
  return request.get<{ code: number; data: { list: AssignmentItem[]; total: number } }>('/permissions', { params });
}

export function getUserCommunities(userId: string) {
  return request.get<UserCommunitiesResult>(`/permissions/user/${userId}`);
}

export function getCommunityUsers(communityId: string) {
  return request.get<CommunityUsersResult>(`/permissions/community/${communityId}`);
}

export function assignPermission(data: { userId: string; communityIds: string[] }) {
  return request.post<{ code: number; data: { message: string; details: { communityId: string; action: string }[] } }>('/permissions/assign', data);
}

export function removePermission(data: { userId: string; communityIds: string[] }) {
  return request.post<{ code: number; data: { message: string; removed: number } }>('/permissions/remove', data);
}
