export enum RoleType {
  SUPER_ADMIN = 'SUPER_ADMIN',
  REGION_ADMIN = 'REGION_ADMIN',
  ADMIN = 'ADMIN',
  OPERATOR = 'OPERATOR',
  VIEWER = 'VIEWER',
}

export const ROLE_LABELS: Record<string, string> = {
  [RoleType.SUPER_ADMIN]: '超级管理员',
  [RoleType.REGION_ADMIN]: '区域管理员',
  [RoleType.ADMIN]: '管理员',
  [RoleType.OPERATOR]: '操作员',
  [RoleType.VIEWER]: '查看者',
};

export const ROLE_HIERARCHY: Record<string, number> = {
  [RoleType.SUPER_ADMIN]: 1,
  [RoleType.REGION_ADMIN]: 2,
  [RoleType.ADMIN]: 3,
  [RoleType.OPERATOR]: 4,
  [RoleType.VIEWER]: 5,
};

export function getRoleLevel(role: string): number {
  return ROLE_HIERARCHY[role] ?? 99;
}
