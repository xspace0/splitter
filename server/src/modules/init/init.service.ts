import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class InitService implements OnApplicationBootstrap {
  private readonly logger = new Logger(InitService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureSuperAdmin();
  }

  private async ensureSuperAdmin() {
    const existing = await this.prisma.sysUser.findFirst({
      where: { roleType: 'SUPER_ADMIN', isDeleted: 0 },
    });

    if (existing) {
      this.logger.log('Super admin already exists, skipping seed');
      return;
    }

    const configured = this.config.get<string>('SUPER_ADMIN_PASSWORD');
    const usingDefault = !configured;
    const password = configured || 'admin123';
    // bcrypt cost=12，与文档《数据库设计》3.1 password_hash 约定一致
    const passwordHash = await bcrypt.hash(password, 12);

    if (usingDefault) {
      this.logger.warn(
        '未配置 SUPER_ADMIN_PASSWORD，已使用默认密码初始化超级管理员，请登录后立即修改！',
      );
    }

    await this.prisma.sysUser.create({
      data: {
        username: '超级管理员',
        account: 'admin',
        passwordHash,
        realNameVerified: 1,
        realNameAuthTime: new Date(),
        roleType: 'SUPER_ADMIN',
        status: 1,
        // seed 创建的首个超级管理员无上级创建人，文档明确为合法例外（应为 NULL，而非 0）
        creatorId: null,
      },
    });

    this.logger.log('Super admin created (account: admin)');
  }
}
