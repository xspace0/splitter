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
  return request.get('/permissions', { params }) as Promise<{ code: number; data: { list: AssignmentItem[]; total: number } }>;
}

export function getUserCommunities(userId: string) {
  return request.get(`/permissions/user/${userId}`) as Promise<UserCommunitiesResult>;
}

export function getCommunityUsers(communityId: string) {
  return request.get(`/permissions/community/${communityId}`) as Promise<CommunityUsersResult>;
}

export function assignPermission(data: { userId: string; communityIds: string[] }) {
  return request.post('/permissions/assign', data) as Promise<{ code: number; data: { message: string; details: { communityId: string; action: string }[] } }>;
}

export function removePermission(data: { userId: string; communityIds: string[] }) {
  return request.post('/permissions/remove', data) as Promise<{ code: number; data: { message: string; removed: number } }>;
}
