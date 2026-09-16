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
import { RoleType } from '@/common/enums/role.enum';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { QueryCommunityDto } from './dto/query-community.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

const _COMMUNITY_STATUS_ACTIVE = 1;
const COMMUNITY_STATUS_DISABLED = 0;
const DELETE_GRACE_DAYS = 30;

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  async create(dto: CreateCommunityDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const existing = await this.prisma.community.findFirst({
      where: { communityName: dto.communityName, isDeleted: 0 },
    });
    if (existing) {
      throw new ConflictException('社区名称已存在');
    }

    let regionId: bigint | null = null;
    if (currentUser.roleType === RoleType.SUPER_ADMIN) {
      regionId = dto.regionId ? BigInt(dto.regionId) : null;
    } else {
      regionId = await this.getUserRegionId(currentUser.id);
    }

    if (currentUser.roleType === RoleType.REGION_ADMIN) {
      throw new ForbiddenException('区域管理员无新增社区权限');
    }

    const community = await this.prisma.community.create({
      data: {
        communityName: dto.communityName,
        regionId: regionId ?? BigInt(0),
        remark: dto.remark || null,
        creatorId: BigInt(currentUser.id),
      },
    });

    this.logger.log(
      `Community created: ${community.communityName} by ${currentUser.account}`,
    );

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: 'CREATE',
      targetType: '社区',
      targetId: community.id,
      operationContent: `新增社区 ${community.communityName}`,
    });

    return this.formatCommunity(community);
  }

  async findAll(query: QueryCommunityDto, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const where: Record<string, unknown> = {};

    if (currentUser.roleType === RoleType.SUPER_ADMIN) {
      where.isDeleted = 0;
    } else {
      where.isDeleted = 0;
      const myRegionId = await this.getUserRegionId(currentUser.id);
      where.regionId = myRegionId;
    }

    if (query.keyword) {
      where.communityName = { contains: query.keyword, mode: 'insensitive' };
    }

    if (query.status !== undefined && query.status !== '') {
      where.status = Number(query.status);
    }

    if (query.regionId && currentUser.roleType === RoleType.SUPER_ADMIN) {
      where.regionId = BigInt(query.regionId);
    }

    const [total, communities] = await Promise.all([
      this.prisma.community.count({ where }),
      this.prisma.community.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
      }),
    ]);

    return {
      list: communities.map((c) => this.formatCommunity(c)),
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    };
  }

  async findOne(id: string, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const community = await this.prisma.community.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!community) {
      throw new NotFoundException('社区不存在');
    }

    if (currentUser.roleType !== RoleType.SUPER_ADMIN) {
      const myRegionId = await this.getUserRegionId(currentUser.id);
      if (community.regionId !== myRegionId) {
        throw new ForbiddenException('无权访问该社区');
      }
    }

    return this.formatCommunity(community);
  }

  async update(id: string, dto: UpdateCommunityDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const community = await this.prisma.community.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!community) {
      throw new NotFoundException('社区不存在');
    }

    await this.checkRegionAccess(currentUser, community.regionId);

    if (community.status === COMMUNITY_STATUS_DISABLED) {
      throw new ForbiddenException('社区已停用，禁止编辑，请先恢复启用');
    }

    if (dto.communityName && dto.communityName !== community.communityName) {
      const existing = await this.prisma.community.findFirst({
        where: { communityName: dto.communityName, isDeleted: 0, NOT: { id: BigInt(id) } },
      });
      if (existing) {
        throw new ConflictException('社区名称已存在');
      }
    }

    const data: { communityName?: string; remark?: string | null } = {};
    if (dto.communityName !== undefined) data.communityName = dto.communityName;
    if (dto.remark !== undefined) data.remark = dto.remark || null;

    const updated = await this.prisma.community.update({
      where: { id: BigInt(id) },
      data,
    });

    this.logger.log(
      `Community ${updated.id} updated by ${currentUser.account}`,
    );

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: 'UPDATE',
      targetType: '社区',
      targetId: BigInt(id),
      operationContent: `修改社区 ${community.communityName}`,
    });

    return this.formatCommunity(updated);
  }

  async updateStatus(id: string, status: number, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const community = await this.prisma.community.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!community) {
      throw new NotFoundException('社区不存在');
    }

    await this.checkRegionAccess(currentUser, community.regionId);

    const data: { status: number; disableTime: Date | null } = {
      status,
      disableTime: status === COMMUNITY_STATUS_DISABLED ? new Date() : null,
    };

    const updated = await this.prisma.community.update({
      where: { id: BigInt(id) },
      data,
    });

    const action = status === COMMUNITY_STATUS_DISABLED ? 'disabled' : 'enabled';
    this.logger.log(
      `Community ${updated.communityName} ${action} by ${currentUser.account}`,
    );

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: status === COMMUNITY_STATUS_DISABLED ? 'DISABLE' : 'ENABLE',
      targetType: '社区',
      targetId: BigInt(id),
      operationContent: `${status === COMMUNITY_STATUS_DISABLED ? '停用' : '恢复启用'}社区 ${community.communityName}${status === COMMUNITY_STATUS_DISABLED ? '，记录disable_time' : '，清空停用时间'}`,
    });

    return this.formatCommunity(updated);
  }

  async remove(id: string, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const community = await this.prisma.community.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!community) {
      throw new NotFoundException('社区不存在');
    }

    await this.checkRegionAccess(currentUser, community.regionId);

    if (community.status !== COMMUNITY_STATUS_DISABLED) {
      throw new BadRequestException('只有停用状态的社区才能删除');
    }

    if (!community.disableTime) {
      throw new BadRequestException('停用时间无效，无法删除');
    }

    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - community.disableTime.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays < DELETE_GRACE_DAYS) {
      throw new BadRequestException(
        `社区停用未满 ${DELETE_GRACE_DAYS} 天（当前 ${diffDays} 天），暂不可删除`,
      );
    }

    const splitterCount = await this.prisma.opticalSplitter.count({
      where: { communityId: BigInt(id), isDeleted: 0 },
    });

    await this.prisma.community.update({
      where: { id: BigInt(id) },
      data: { isDeleted: 1 },
    });

    if (splitterCount > 0) {
      await this.prisma.opticalSplitter.updateMany({
        where: { communityId: BigInt(id), isDeleted: 0 },
        data: { isDeleted: 1 },
      });
    }

    this.logger.log(
      `Community ${community.communityName} deleted (${splitterCount} splitters) by ${currentUser.account}`,
    );

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: 'DELETE',
      targetType: '社区',
      targetId: BigInt(id),
      operationContent: `删除社区 ${community.communityName}${splitterCount > 0 ? `，批量逻辑删除（${splitterCount}条分光器）` : ''}`,
    });

    return { message: '删除成功', deletedSplitters: splitterCount };
  }

  private checkReadPermission(currentUser: RequestUser) {
    if (currentUser.roleType === RoleType.VIEWER) {
      throw new ForbiddenException('查看者无权访问社区管理列表');
    }
    if (currentUser.roleType === RoleType.OPERATOR) {
      throw new ForbiddenException('操作员无权访问社区管理列表');
    }
  }

  private checkWritePermission(currentUser: RequestUser) {
    const allowed = [RoleType.SUPER_ADMIN, RoleType.ADMIN];
    if (!allowed.includes(currentUser.roleType as RoleType)) {
      throw new ForbiddenException('您没有社区管理写权限');
    }
  }

  private async checkRegionAccess(currentUser: RequestUser, regionId: bigint) {
    if (currentUser.roleType === RoleType.SUPER_ADMIN) return;

    const myRegionId = await this.getUserRegionId(currentUser.id);
    if (myRegionId !== regionId) {
      throw new ForbiddenException('无权操作其他区域的社区');
    }
  }

  private async getUserRegionId(userId: string): Promise<bigint> {
    const user = await this.prisma.sysUser.findUnique({
      where: { id: BigInt(userId) },
      select: { regionId: true },
    });
    return user?.regionId ?? BigInt(0);
  }

  private formatCommunity(community: {
    id: bigint;
    communityName: string;
    regionId: bigint;
    remark: string | null;
    status: number;
    disableTime: Date | null;
    isDeleted: number;
    creatorId: bigint;
    createTime: Date;
    updateTime: Date;
  }) {
    return {
      id: community.id.toString(),
      communityName: community.communityName,
      regionId: community.regionId.toString(),
      remark: community.remark,
      status: community.status,
      disableTime: community.disableTime,
      isDeleted: community.isDeleted,
      creatorId: community.creatorId.toString(),
      createTime: community.createTime,
      updateTime: community.updateTime,
    };
  }
}
