import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RoleType } from '@/common/enums/role.enum';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { ALLOW_UNVERIFIED_KEY } from '@/common/decorators/allow-unverified.decorator';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

/** 构造一个最小可用的 ExecutionContext */
function createContext(user: unknown): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

/** 用一张元数据表模拟 Reflector */
function createReflector(meta: Record<string, unknown>): Reflector {
  return {
    getAllAndOverride: (key: string) => meta[key],
  } as unknown as Reflector;
}

const verifiedUser = (roleType: RoleType) => ({
  id: '1',
  account: 'tester',
  roleType,
  realNameVerified: 1,
  regionId: '1',
});

describe('RolesGuard', () => {
  it('公开接口直接放行', () => {
    const guard = new RolesGuard(createReflector({ [IS_PUBLIC_KEY]: true }));
    expect(guard.canActivate(createContext(undefined))).toBe(true);
  });

  it('未实名认证且未标记 @AllowUnverified 时返回 2001', () => {
    const guard = new RolesGuard(createReflector({}));
    const user = { ...verifiedUser(RoleType.OPERATOR), realNameVerified: 0 };
    try {
      guard.canActivate(createContext(user));
      throw new Error('应当抛出 ForbiddenException');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 2001 });
    }
  });

  it('标记 @AllowUnverified 时跳过实名认证校验', () => {
    const guard = new RolesGuard(createReflector({ [ALLOW_UNVERIFIED_KEY]: true }));
    const user = { ...verifiedUser(RoleType.VIEWER), realNameVerified: 0 };
    expect(guard.canActivate(createContext(user))).toBe(true);
  });

  it('未声明 @Roles 时不限制角色', () => {
    const guard = new RolesGuard(createReflector({}));
    expect(guard.canActivate(createContext(verifiedUser(RoleType.VIEWER)))).toBe(true);
  });

  it('角色匹配时放行', () => {
    const guard = new RolesGuard(
      createReflector({ [ROLES_KEY]: [RoleType.SUPER_ADMIN, RoleType.ADMIN] }),
    );
    expect(guard.canActivate(createContext(verifiedUser(RoleType.ADMIN)))).toBe(true);
  });

  it('角色不匹配时返回业务错误码 3001 而不是 HTTP 状态码', () => {
    const guard = new RolesGuard(createReflector({ [ROLES_KEY]: [RoleType.SUPER_ADMIN] }));
    try {
      guard.canActivate(createContext(verifiedUser(RoleType.OPERATOR)));
      throw new Error('应当抛出 ForbiddenException');
    } catch (e) {
      expect(e).toBeInstanceOf(ForbiddenException);
      expect((e as ForbiddenException).getStatus()).toBe(403);
      expect((e as ForbiddenException).getResponse()).toMatchObject({ code: 3001 });
    }
  });
});
