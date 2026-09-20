import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RoleType, getRoleLevel } from '@/common/enums/role.enum';
import { AssignPermissionDto, RemovePermissionDto } from './dto/assign-permission.dto';
import { QueryPermissionDto } from './dto/query-permission.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

const ASSIGN_STATUS_ACTIVE = 1;
const ASSIGN_STATUS_REMOVED = 0;

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  async assign(dto: AssignPermissionDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const targetUserId = BigInt(dto.userId);

    const targetUser = await this.prisma.sysUser.findFirst({
      where: { id: targetUserId, isDeleted: 0 },
    });

    if (!targetUser) {
      throw new NotFoundException('目标用户不存在');
    }

    if (targetUser.roleType !== RoleType.OPERATOR && targetUser.roleType !== RoleType.VIEWER) {
      throw new BadRequestException('只能为操作员或查看者分配社区');
    }

    // 权限层级校验：操作者不能分配给同级或更高级
    if (getRoleLevel(currentUser.roleType) >= getRoleLevel(targetUser.roleType)) {
      throw new ForbiddenException('不能为同级或更高权限的用户分配社区');
    }

    // 区域管理员只能分配自己区域内的社区给操作员
    let regionFilter: bigint | null = null;
    if (currentUser.roleType !== RoleType.SUPER_ADMIN) {
      const me = await this.prisma.sysUser.findUnique({
        where: { id: BigInt(currentUser.id) },
        select: { regionId: true },
      });
      regionFilter = me?.regionId ?? null;
    }

    // 验证所有社区存在且属于操作者区域
    const communities = await this.prisma.community.findMany({
      where: {
        id: { in: dto.communityIds.map((id) => BigInt(id)) },
        isDeleted: 0,
      },
    });

    if (communities.length !== dto.communityIds.length) {
      throw new BadRequestException('部分社区不存在或已删除');
    }

    if (regionFilter !== null) {
      const outOfRegion = communities.filter((c) => c.regionId !== regionFilter);
      if (outOfRegion.length > 0) {
        throw new ForbiddenException('不能分配其他区域的社区');
      }
    }

    // 社区归属唯一：同一社区有效状态下只能归属一个操作员（文档 3.1 / 数据库设计 3.4）
    // 已归属他人时需显式指定 force，执行「改派」（原记录置 0，再分配给新用户）
    const takenCommunityIds: bigint[] = [];
    for (const communityId of dto.communityIds) {
      const owner = await this.prisma.sysUserCommunity.findFirst({
        where: {
          communityId: BigInt(communityId),
          userId: { not: targetUserId },
          status: ASSIGN_STATUS_ACTIVE,
          isDeleted: 0,
        },
        orderBy: { createTime: 'asc' },
      });
      if (owner) takenCommunityIds.push(BigInt(communityId));
    }

    if (takenCommunityIds.length > 0 && !dto.force) {
      const names = takenCommunityIds.map((cid) => {
        const c = communities.find((x) => x.id === cid);
        return c?.communityName ?? cid.toString();
      });
      throw new ConflictException(
        `以下社区已归属其他操作员，如需改派请传入 force=true：${names.join('、')}`,
      );
    }

    // 改派：先把这些社区的原有有效归属置为已移除
    let reassignedCount = 0;
    if (takenCommunityIds.length > 0) {
      const result = await this.prisma.sysUserCommunity.updateMany({
        where: {
          communityId: { in: takenCommunityIds },
          userId: { not: targetUserId },
          status: ASSIGN_STATUS_ACTIVE,
          isDeleted: 0,
        },
        data: { status: ASSIGN_STATUS_REMOVED },
      });
      reassignedCount = result.count;
    }

    // 查找已有关联，更新或新建
    const results: { communityId: string; action: string }[] = [];

    for (const communityId of dto.communityIds) {
      const existing = await this.prisma.sysUserCommunity.findFirst({
        where: {
          userId: targetUserId,
          communityId: BigInt(communityId),
          isDeleted: 0,
        },
      });

      if (existing) {
        if (existing.status === ASSIGN_STATUS_ACTIVE) {
          results.push({ communityId, action: 'already_active' });
          continue;
        }

        await this.prisma.sysUserCommunity.update({
          where: { id: existing.id },
          data: { status: ASSIGN_STATUS_ACTIVE },
        });
        results.push({ communityId, action: 'reactivated' });
      } else {
        await this.prisma.sysUserCommunity.create({
          data: {
            userId: targetUserId,
            communityId: BigInt(communityId),
            creatorId: BigInt(currentUser.id),
            status: ASSIGN_STATUS_ACTIVE,
          },
        });
        results.push({ communityId, action: 'created' });
      }
    }

    this.logger.log(
      `Permissions assigned: user ${targetUser.account} -> ${dto.communityIds.length} communities by ${currentUser.account}`,
    );

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '权限分配',
      targetType: '权限',
      targetId: targetUserId,
      operationContent: `分配社区权限给操作员 ${targetUser.username}(${targetUser.account})，共${dto.communityIds.length}个社区`,
    });

    return {
      message: takenCommunityIds.length > 0 ? '权限分配成功（含改派）' : '权限分配成功',
      reassigned: reassignedCount,
      details: results,
    };
  }

  async remove(dto: RemovePermissionDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const targetUserId = BigInt(dto.userId);

    const targetUser = await this.prisma.sysUser.findFirst({
      where: { id: targetUserId, isDeleted: 0 },
    });

    if (!targetUser) {
      throw new NotFoundException('目标用户不存在');
    }

    if (getRoleLevel(currentUser.roleType) >= getRoleLevel(targetUser.roleType)) {
      throw new ForbiddenException('不能移除同级或更高权限用户的社区权限');
    }

    const result = await this.prisma.sysUserCommunity.updateMany({
      where: {
        userId: targetUserId,
        communityId: { in: dto.communityIds.map((id) => BigInt(id)) },
        isDeleted: 0,
      },
      data: { status: ASSIGN_STATUS_REMOVED },
    });

    this.logger.log(
      `Permissions removed: user ${targetUser.account} <- ${dto.communityIds.length} communities by ${currentUser.account} (${result.count} updated)`,
    );

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '权限分配',
      targetType: '权限',
      targetId: targetUserId,
      operationContent: `移除操作员 ${targetUser.username}(${targetUser.account}) 的${result.count}个社区权限`,
    });

    return {
      message: '权限移除成功',
      removed: result.count,
    };
  }

  async findByUser(userId: string, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const targetUserId = BigInt(userId);
    const user = await this.prisma.sysUser.findFirst({
      where: { id: targetUserId, isDeleted: 0 },
      select: {
        id: true,
        username: true,
        account: true,
        roleType: true,
        regionId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const assignments = await this.prisma.sysUserCommunity.findMany({
      where: { userId: targetUserId, isDeleted: 0, status: 1 },
      orderBy: { createTime: 'desc' },
    });

    const communityIds = assignments.map((a) => a.communityId);
    const communities = communityIds.length > 0
      ? await this.prisma.community.findMany({
          where: { id: { in: communityIds } },
          select: {
            id: true,
            communityName: true,
            regionId: true,
            status: true,
            isDeleted: true,
          },
        })
      : [];
    const communityMap = new Map(communities.map((c) => [c.id, c]));

    return {
      user: {
        id: user.id.toString(),
        username: user.username,
        account: user.account,
        roleType: user.roleType,
        regionId: user.regionId?.toString() || null,
      },
      communities: assignments.map((a) => {
        const c = communityMap.get(a.communityId);
        return {
          assignmentId: a.id.toString(),
          status: a.status,
          community: c
            ? {
                id: c.id.toString(),
                communityName: c.communityName,
                regionId: c.regionId.toString(),
                status: c.status,
              }
            : null,
          createTime: a.createTime,
          updateTime: a.updateTime,
        };
      }),
    };
  }

  async findByCommunity(communityId: string, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const cid = BigInt(communityId);
    const community = await this.prisma.community.findFirst({
      where: { id: cid, isDeleted: 0 },
    });

    if (!community) {
      throw new NotFoundException('社区不存在');
    }

    // 区域权限校验
    if (currentUser.roleType !== RoleType.SUPER_ADMIN) {
      const me = await this.prisma.sysUser.findUnique({
        where: { id: BigInt(currentUser.id) },
        select: { regionId: true },
      });
      if (me?.regionId !== community.regionId) {
        throw new ForbiddenException('无权查看其他区域的社区权限');
      }
    }

    const assignments = await this.prisma.sysUserCommunity.findMany({
      where: { communityId: cid, isDeleted: 0, status: 1 },
      orderBy: { createTime: 'desc' },
    });

    const userIds = assignments.map((a) => a.userId);
    const users = userIds.length > 0
      ? await this.prisma.sysUser.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            username: true,
            account: true,
            roleType: true,
            phone: true,
            realNameVerified: true,
          },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      community: {
        id: community.id.toString(),
        communityName: community.communityName,
        status: community.status,
      },
      users: assignments.map((a) => {
        const u = userMap.get(a.userId);
        return {
          assignmentId: a.id.toString(),
          status: a.status,
          user: u
            ? {
                id: u.id.toString(),
                username: u.username,
                account: u.account,
                roleType: u.roleType,
                phone: u.phone,
                realNameVerified: u.realNameVerified,
              }
            : null,
          createTime: a.createTime,
        };
      }),
    };
  }

  async findAssignments(query: QueryPermissionDto, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const where: Record<string, unknown> = { isDeleted: 0 };

    if (query.userId) {
      where.userId = BigInt(query.userId);
    }

    if (query.communityId) {
      where.communityId = BigInt(query.communityId);
    }

    // 区域过滤
    if (currentUser.roleType !== RoleType.SUPER_ADMIN) {
      const me = await this.prisma.sysUser.findUnique({
        where: { id: BigInt(currentUser.id) },
        select: { regionId: true },
      });
      const myRegionId = me?.regionId ?? BigInt(0);

      const regionCommunities = await this.prisma.community.findMany({
        where: { regionId: myRegionId, isDeleted: 0 },
        select: { id: true },
      });
      where.communityId = {
        in: regionCommunities.map((c) => c.id),
      };
    }

    const [total, assignments] = await Promise.all([
      this.prisma.sysUserCommunity.count({ where }),
      this.prisma.sysUserCommunity.findMany({
        where,
        orderBy: { createTime: 'desc' },
        take: 200,
      }),
    ]);

    const userIds = [...new Set(assignments.map((a) => a.userId))];
    const communityIds = [...new Set(assignments.map((a) => a.communityId))];

    const [users, communities] = await Promise.all([
      userIds.length > 0
        ? this.prisma.sysUser.findMany({
            where: { id: { in: userIds } },
            select: { id: true, username: true, account: true, roleType: true },
          })
        : [],
      communityIds.length > 0
        ? this.prisma.community.findMany({
            where: { id: { in: communityIds } },
            select: { id: true, communityName: true },
          })
        : [],
    ]);

    const userMap = new Map(users.map((u) => [u.id, u]));
    const communityMap = new Map(communities.map((c) => [c.id, c]));

    return {
      list: assignments.map((a) => {
        const u = userMap.get(a.userId);
        const c = communityMap.get(a.communityId);
        return {
          id: a.id.toString(),
          userId: a.userId.toString(),
          username: u?.username || '',
          account: u?.account || '',
          roleType: u?.roleType || '',
          communityId: a.communityId.toString(),
          communityName: c?.communityName || '',
          status: a.status,
          createTime: a.createTime,
          updateTime: a.updateTime,
        };
      }),
      total,
    };
  }

  private checkReadPermission(currentUser: RequestUser) {
    // 只有超管和管理员可查看权限分配
    const allowed = [
      RoleType.SUPER_ADMIN,
      RoleType.ADMIN,
    ];
    if (!allowed.includes(currentUser.roleType as RoleType)) {
      throw new ForbiddenException('您无权查看权限分配');
    }
  }

  private checkWritePermission(currentUser: RequestUser) {
    // 只有超管和管理员可分配权限，区域管理员无此权限
    const allowed = [
      RoleType.SUPER_ADMIN,
      RoleType.ADMIN,
    ];
    if (!allowed.includes(currentUser.roleType as RoleType)) {
      throw new ForbiddenException('您无权分配权限');
    }
  }
}
