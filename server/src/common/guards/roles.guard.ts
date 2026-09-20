import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '@/common/enums/role.enum';
import { ROLES_KEY } from '@/common/decorators/roles.decorator';
import { ALLOW_UNVERIFIED_KEY } from '@/common/decorators/allow-unverified.decorator';
import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

const ERR_REAL_NAME_UNVERIFIED = 2001;
const ERR_NO_PERMISSION = 3001;

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const { user } = context.switchToHttp().getRequest();

    // 1. 实名认证校验（默认强制，标记 @AllowUnverified 的接口放行）
    const allowUnverified = this.reflector.getAllAndOverride<boolean>(
      ALLOW_UNVERIFIED_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!allowUnverified) {
      if (!user?.realNameVerified) {
        throw new ForbiddenException({
          code: ERR_REAL_NAME_UNVERIFIED,
          message: '用户未完成实名认证',
        });
      }
    }

    // 2. 角色权限校验
    const requiredRoles = this.reflector.getAllAndOverride<RoleType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) {
      return true;
    }
    if (!requiredRoles.includes(user?.roleType)) {
      // 抛出业务错误码，保证前端拿到 3001 而非 HTTP 状态码
      throw new ForbiddenException({
        code: ERR_NO_PERMISSION,
        message: '当前角色无该功能操作权限',
      });
    }
    return true;
  }
}
