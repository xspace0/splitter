import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LogService } from '../log/log.service';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private logService: LogService,
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

    this.logService.log({
      userId: user.id,
      operationType: 'LOGIN',
      targetType: '用户',
      targetId: user.id,
      operationContent: 'PC端账号密码登录',
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

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(userId), isDeleted: 0 },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (!user.passwordHash) {
      throw new BadRequestException('该账号未设置密码，请联系管理员');
    }

    const isOldValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isOldValid) {
      throw new BadRequestException('原密码错误');
    }

    if (newPassword.length < 6) {
      throw new BadRequestException('新密码至少6位');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.sysUser.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    this.logger.log(`User ${user.account} changed password`);
    return { message: '密码修改成功' };
  }

  async updateProfile(userId: string, data: { username?: string; phone?: string }) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(userId), isDeleted: 0 },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    const updateData: { username?: string; phone?: string } = {};
    if (data.username !== undefined) updateData.username = data.username;
    if (data.phone !== undefined) updateData.phone = data.phone;

    await this.prisma.sysUser.update({
      where: { id: user.id },
      data: updateData,
    });

    return { message: '信息更新成功' };
  }

  async miniLogin(code: string, ip?: string) {
    // 小程序登录：简化实现，用code模拟openid
    // 实际项目需调用微信接口: https://api.weixin.qq.com/sns/jscode2session
    const openid = 'mini_' + code;

    let user = await this.prisma.sysUser.findFirst({
      where: { wxOpenid: openid, isDeleted: 0 },
    });

    if (!user) {
      // 首次登录创建小程序用户
      user = await this.prisma.sysUser.create({
        data: {
          account: `mini_${code.substring(0, 10)}`,
          username: '小程序用户',
          passwordHash: null,
          roleType: 'VIEWER',
          status: 1,
          wxOpenid: openid,
          realNameVerified: 0,
        },
      });
    }

    if (user.status !== 1) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const payload: JwtPayload = {
      sub: user.id.toString(),
      account: user.account || '',
      roleType: user.roleType,
    };

    const token = this.jwtService.sign(payload, { expiresIn: '7d' });

    await this.prisma.sysUser.update({
      where: { id: user.id },
      data: { lastLoginTime: new Date() },
    });

    this.logService.log({
      userId: user.id,
      operationType: 'LOGIN',
      targetType: '用户',
      targetId: user.id,
      operationContent: '小程序微信登录',
      ip,
    });

    return {
      token,
      user: {
        id: user.id.toString(),
        account: user.account,
        username: user.username,
        roleType: user.roleType,
        realNameVerified: user.realNameVerified,
        phone: user.phone,
        region: user.regionId?.toString() || '',
      },
    };
  }

  async submitRealName(userId: string, data: {
    realName: string;
    idCard: string;
    province: string;
    city: string;
    district: string;
  }) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(userId), isDeleted: 0 },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.realNameVerified === 1) {
      throw new BadRequestException('已完成实名认证，不可重复提交');
    }

    // 简单校验身份证号格式
    if (!/^\d{17}[\dXx]$/.test(data.idCard)) {
      throw new BadRequestException('身份证号格式不正确');
    }

    // 简化实现：直接认证通过
    await this.prisma.sysUser.update({
      where: { id: user.id },
      data: {
        username: data.realName,
        realNameVerified: 1,
        realNameAuthTime: new Date(),
        idCardNo: data.idCard,
      },
    });

    this.logService.log({
      userId: user.id,
      operationType: 'UPDATE',
      targetType: '用户',
      targetId: user.id,
      operationContent: `实名认证通过：${data.realName}`,
    });

    return { message: '认证成功' };
  }
}
