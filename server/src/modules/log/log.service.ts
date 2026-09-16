import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoleType } from '@/common/enums/role.enum';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { QueryLogDto } from './dto/query-log.dto';

@Injectable()
export class LogService {
  constructor(private prisma: PrismaService) {}

  async findMany(query: QueryLogDto, currentUser: RequestUser) {
    if (currentUser.roleType !== RoleType.SUPER_ADMIN) {
      throw new ForbiddenException('仅超级管理员可查询操作日志');
    }

    const where: Record<string, unknown> = {};

    if (query.operationType) {
      where.operationType = query.operationType;
    }

    if (query.targetType) {
      where.targetType = query.targetType;
    }

    if (query.startDate || query.endDate) {
      const timeFilter: { gte?: Date; lte?: Date } = {};
      if (query.startDate) {
        timeFilter.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        timeFilter.lte = new Date(query.endDate + 'T23:59:59.999Z');
      }
      where.createTime = timeFilter;
    }

    const [total, logs] = await Promise.all([
      this.prisma.sysOperationLog.count({ where }),
      this.prisma.sysOperationLog.findMany({
        where,
        orderBy: { createTime: 'desc' },
        skip: query.skip,
        take: query.take,
      }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId))];
    const users = userIds.length > 0
      ? await this.prisma.sysUser.findMany({
          where: { id: { in: userIds } },
          select: { id: true, username: true, account: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      list: logs.map((l) => {
        const u = userMap.get(l.userId);
        return {
          id: l.id.toString(),
          userId: l.userId.toString(),
          username: u?.username || '未知用户',
          account: u?.account || '',
          operationType: l.operationType,
          targetType: l.targetType,
          targetId: l.targetId?.toString() || null,
          operationContent: l.operationContent,
          ip: l.ip,
          userAgent: l.userAgent,
          createTime: l.createTime,
        };
      }),
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    };
  }

  async log(data: {
    userId: bigint;
    operationType: string;
    targetType: string;
    targetId?: bigint | null;
    operationContent?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    try {
      await this.prisma.sysOperationLog.create({
        data: {
          userId: data.userId,
          operationType: data.operationType,
          targetType: data.targetType,
          targetId: data.targetId ?? null,
          operationContent: data.operationContent ?? null,
          ip: data.ip ?? null,
          userAgent: data.userAgent ?? null,
        },
      });
    } catch (e) {
      console.error('Failed to write operation log:', e);
    }
  }
}
