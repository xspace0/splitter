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

    const password =
      this.config.get<string>('SUPER_ADMIN_PASSWORD') || 'admin123';
    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.sysUser.create({
      data: {
        username: '超级管理员',
        account: 'admin',
        passwordHash,
        realNameVerified: 1,
        roleType: 'SUPER_ADMIN',
        status: 1,
        creatorId: 0n,
      },
    });

    this.logger.log('Super admin created (account: admin)');
  }
}
