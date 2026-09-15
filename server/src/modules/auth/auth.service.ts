import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(account: string, password: string) {
    const user = await this.prisma.sysUser.findFirst({
      where: {
        account,
        isDeleted: 0,
        status: 1,
      },
    });

    if (!user) {
      throw new UnauthorizedException('账号不存在或已禁用');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('该账号未设置密码，请联系管理员');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('密码错误');
    }

    await this.prisma.sysUser.update({
      where: { id: user.id },
      data: { lastLoginTime: new Date() },
    });

    const payload: JwtPayload = {
      sub: user.id.toString(),
      account: user.account!,
      roleType: user.roleType,
    };

    const token = await this.jwtService.signAsync(payload);

    return {
      token,
      user: {
        id: user.id.toString(),
        account: user.account,
        username: user.username,
        roleType: user.roleType,
        realNameVerified: user.realNameVerified,
      },
    };
  }

  async getProfile(userId: string) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(userId), isDeleted: 0 },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      id: user.id.toString(),
      account: user.account,
      username: user.username,
      roleType: user.roleType,
      realNameVerified: user.realNameVerified,
      phone: user.phone,
      lastLoginTime: user.lastLoginTime,
    };
  }
}
