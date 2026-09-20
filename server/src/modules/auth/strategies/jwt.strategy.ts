import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../../prisma/prisma.service';

const ERR_TOKEN_INVALID = 1001;
const ERR_ACCOUNT_OFFLINE = 1002;

export interface JwtPayload {
  sub: string;
  account: string;
  roleType: string;
  realNameVerified: number;
  regionId: string;
}

export interface RequestUser {
  id: string;
  account: string;
  username: string;
  roleType: string;
  realNameVerified: number;
  regionId: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'fallback-secret',
    });
  }

  /**
   * 每次请求都回查数据库，确保「账号禁用 / 逻辑删除 / 角色变更」即时生效，
   * 而不是等到 7 天 token 自然过期（文档 3.2 / 5.5 明确要求）。
   * 不再直接信任 token 中的 roleType / realNameVerified / regionId。
   */
  async validate(payload: JwtPayload): Promise<RequestUser> {
    let userId: bigint;
    try {
      userId = BigInt(payload.sub);
    } catch {
      throw new UnauthorizedException({ code: ERR_TOKEN_INVALID, message: 'Token 无效或已过期' });
    }

    const user = await this.prisma.sysUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        account: true,
        username: true,
        roleType: true,
        realNameVerified: true,
        regionId: true,
        status: true,
        isDeleted: true,
      },
    });

    if (!user || user.isDeleted === 1) {
      throw new UnauthorizedException({ code: ERR_TOKEN_INVALID, message: 'Token 无效或已过期' });
    }

    if (user.status !== 1) {
      throw new UnauthorizedException({
        code: ERR_ACCOUNT_OFFLINE,
        message: 'Token 已加入黑名单，账号强制下线',
      });
    }

    const roleType = user.roleType as string;
    const regionId = user.regionId?.toString() ?? '';

    // 说明：区县维度角色（区域管理员/管理员/查看者）若未绑定区县，
    // 不能在此处直接 401 —— 会导致用户刚登录就被踢回登录页，无法自助处理。
    // 改为放行登录态，由各业务接口按数据权限返回 403 + 业务码
    // （3002 无该条数据权限 / 4001 参数错误），错误提示更准确且可自愈。
    return {
      id: user.id.toString(),
      account: user.account ?? '',
      username: user.username,
      roleType,
      realNameVerified: user.realNameVerified,
      regionId,
    };
  }
}
