import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RoleType } from '@/common/enums/role.enum';
import { CreateSplitterDto } from './dto/create-splitter.dto';
import { UpdateSplitterDto } from './dto/update-splitter.dto';
import { QuerySplitterDto } from './dto/query-splitter.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

// 分光器状态
const SPLITTER_STATUS_NORMAL = 1;
const SPLITTER_STATUS_FAULT = 2;
const SPLITTER_STATUS_STOPPED = 3;
const SPLITTER_STATUS_UNDER_CONSTRUCTION = 4;

// 分光器级别
const SPLITTER_LEVEL_OPTICAL_CROSS = 1;
const SPLITTER_LEVEL_LEVEL1 = 2;
const SPLITTER_LEVEL_LEVEL2 = 3;
const SPLITTER_LEVEL_CABLE_TERMINAL = 4;

@Injectable()
export class SplitterService {
  private readonly logger = new Logger(SplitterService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSplitterDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    // 验证社区存在且用户有权限
    const community = await this.prisma.community.findFirst({
      where: { id: BigInt(dto.communityId), isDeleted: 0 },
    });
    if (!community) {
      throw new NotFoundException('社区不存在');
    }
    await this.checkRegionAccess(currentUser, community.regionId);

    // 验证级别合法性
    this.validateLevel(dto.splitterLevel);

    // 验证父节点
    let parentId: bigint | null = null;
    if (dto.parentId) {
      const parent = await this.prisma.opticalSplitter.findFirst({
        where: { id: BigInt(dto.parentId), isDeleted: 0 },
      });
      if (!parent) {
        throw new NotFoundException('父节点不存在');
      }
      // 验证级别关系：子级别必须比父级别大1
      if (dto.splitterLevel !== parent.splitterLevel + 1) {
        throw new BadRequestException(
          `子节点级别(${dto.splitterLevel})必须比父节点级别(${parent.splitterLevel})大1`,
        );
      }
      // 验证社区一致
      if (parent.communityId !== BigInt(dto.communityId)) {
        throw new BadRequestException('父节点与子节点必须属于同一社区');
      }
      parentId = parent.id;
    } else {
      // 没有父节点时，必须是光交级别
      if (dto.splitterLevel !== SPLITTER_LEVEL_OPTICAL_CROSS) {
        throw new BadRequestException('顶级节点必须是光交级别');
      }
    }

    // 名称唯一性检查
    const existing = await this.prisma.opticalSplitter.findFirst({
      where: { splitterName: dto.splitterName, isDeleted: 0 },
    });
    if (existing) {
      throw new ConflictException('分光器名称已存在');
    }

    const splitter = await this.prisma.opticalSplitter.create({
      data: {
        splitterName: dto.splitterName,
        communityId: BigInt(dto.communityId),
        splitterLevel: dto.splitterLevel,
        parentId,
        splitRatio: dto.splitRatio || null,
        installLocation: dto.installLocation || null,
        longitude: dto.longitude ? parseFloat(dto.longitude) : null,
        latitude: dto.latitude ? parseFloat(dto.latitude) : null,
        status: dto.status || SPLITTER_STATUS_NORMAL,
        remark: dto.remark || null,
        operatorId: BigInt(currentUser.id),
        creatorId: BigInt(currentUser.id),
      },
    });

    this.logger.log(
      `Splitter created: ${splitter.splitterName} (level ${splitter.splitterLevel}) by ${currentUser.account}`,
    );

    return this.formatSplitter(splitter);
  }

  async findAll(query: QuerySplitterDto, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const where: Record<string, unknown> = { isDeleted: 0 };

    // 数据权限过滤
    if (currentUser.roleType !== RoleType.SUPER_ADMIN) {
      const myRegionId = await this.getUserRegionId(currentUser.id);
      // 获取用户区域内的社区列表
      const communities = await this.prisma.community.findMany({
        where: { regionId: myRegionId, isDeleted: 0 },
        select: { id: true },
      });
      where.communityId = { in: communities.map((c) => c.id) };
    }

    if (query.keyword) {
      where.splitterName = { contains: query.keyword, mode: 'insensitive' };
    }

    if (query.communityId) {
      where.communityId = BigInt(query.communityId);
    }

    if (query.parentId !== undefined) {
      where.parentId = query.parentId ? BigInt(query.parentId) : null;
    }

    if (query.splitterLevel !== undefined) {
      where.splitterLevel = query.splitterLevel;
    }

    if (query.status !== undefined) {
      where.status = query.status;
    }

    const [total, splitters] = await Promise.all([
      this.prisma.opticalSplitter.count({ where }),
      this.prisma.opticalSplitter.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
      }),
    ]);

    return {
      list: splitters.map((s) => this.formatSplitter(s)),
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    };
  }

  async findTree(communityId: string, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    // 验证社区权限
    const community = await this.prisma.community.findFirst({
      where: { id: BigInt(communityId), isDeleted: 0 },
    });
    if (!community) {
      throw new NotFoundException('社区不存在');
    }
    await this.checkRegionAccess(currentUser, community.regionId);

    // 获取社区下所有分光器
    const allSplitters = await this.prisma.opticalSplitter.findMany({
      where: { communityId: BigInt(communityId), isDeleted: 0 },
      orderBy: { splitterName: 'asc' },
    });

    // 构建树形结构
    type SplitterTreeNode = ReturnType<typeof this.formatSplitter> & {
      children: SplitterTreeNode[];
    };
    const formatted: SplitterTreeNode[] = allSplitters.map((s) => ({
      ...this.formatSplitter(s),
      children: [],
    }));

    const idMap = new Map<string, SplitterTreeNode>();
    formatted.forEach((item) => idMap.set(item.id, item));

    const roots: SplitterTreeNode[] = [];
    formatted.forEach((item) => {
      if (item.parentId && idMap.has(item.parentId)) {
        idMap.get(item.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    });

    return roots;
  }

  async findOne(id: string, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const splitter = await this.prisma.opticalSplitter.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!splitter) {
      throw new NotFoundException('分光器不存在');
    }

    // 验证区域权限
    const community = await this.prisma.community.findFirst({
      where: { id: splitter.communityId, isDeleted: 0 },
    });
    if (community) {
      await this.checkRegionAccess(currentUser, community.regionId);
    }

    return this.formatSplitter(splitter);
  }

  async update(id: string, dto: UpdateSplitterDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const splitter = await this.prisma.opticalSplitter.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!splitter) {
      throw new NotFoundException('分光器不存在');
    }

    // 验证区域权限
    const community = await this.prisma.community.findFirst({
      where: { id: splitter.communityId, isDeleted: 0 },
    });
    if (community) {
      await this.checkRegionAccess(currentUser, community.regionId);
    }

    // 停用状态不允许编辑
    if (splitter.status === SPLITTER_STATUS_STOPPED) {
      throw new ForbiddenException('分光器已停用，禁止编辑，请先恢复');
    }

    // 名称唯一性检查
    if (dto.splitterName && dto.splitterName !== splitter.splitterName) {
      const existing = await this.prisma.opticalSplitter.findFirst({
        where: {
          splitterName: dto.splitterName,
          isDeleted: 0,
          NOT: { id: BigInt(id) },
        },
      });
      if (existing) {
        throw new ConflictException('分光器名称已存在');
      }
    }

    // 父节点变更验证
    let parentId: bigint | null | undefined = undefined;
    if (dto.parentId !== undefined) {
      if (dto.parentId === '') {
        // 改为顶级节点
        if (splitter.splitterLevel !== SPLITTER_LEVEL_OPTICAL_CROSS) {
          throw new BadRequestException('只有光交级别才能作为顶级节点');
        }
        parentId = null;
      } else {
        const newParent = await this.prisma.opticalSplitter.findFirst({
          where: { id: BigInt(dto.parentId), isDeleted: 0 },
        });
        if (!newParent) {
          throw new NotFoundException('新父节点不存在');
        }
        if (splitter.splitterLevel !== newParent.splitterLevel + 1) {
          throw new BadRequestException(
            `子节点级别(${splitter.splitterLevel})必须比父节点级别(${newParent.splitterLevel})大1`,
          );
        }
        if (newParent.communityId !== splitter.communityId) {
          throw new BadRequestException('父节点与子节点必须属于同一社区');
        }
        // 防止成为自己的后代
        const descendants = await this.getAllDescendantIds(BigInt(id));
        if (descendants.includes(newParent.id)) {
          throw new BadRequestException('不能将节点移动到自己的后代节点下');
        }
        parentId = newParent.id;
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.splitterName !== undefined) data.splitterName = dto.splitterName;
    if (parentId !== undefined) data.parentId = parentId;
    if (dto.splitRatio !== undefined) data.splitRatio = dto.splitRatio || null;
    if (dto.installLocation !== undefined)
      data.installLocation = dto.installLocation || null;
    if (dto.longitude !== undefined)
      data.longitude = dto.longitude ? parseFloat(dto.longitude) : null;
    if (dto.latitude !== undefined)
      data.latitude = dto.latitude ? parseFloat(dto.latitude) : null;
    if (dto.remark !== undefined) data.remark = dto.remark || null;
    data.operatorId = BigInt(currentUser.id);

    const updated = await this.prisma.opticalSplitter.update({
      where: { id: BigInt(id) },
      data,
    });

    this.logger.log(
      `Splitter ${updated.splitterName} updated by ${currentUser.account}`,
    );

    return this.formatSplitter(updated);
  }

  async updateStatus(id: string, status: number, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const splitter = await this.prisma.opticalSplitter.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!splitter) {
      throw new NotFoundException('分光器不存在');
    }

    // 验证区域权限
    const community = await this.prisma.community.findFirst({
      where: { id: splitter.communityId, isDeleted: 0 },
    });
    if (community) {
      await this.checkRegionAccess(currentUser, community.regionId);
    }

    this.validateStatus(status);

    const updated = await this.prisma.opticalSplitter.update({
      where: { id: BigInt(id) },
      data: { status, operatorId: BigInt(currentUser.id) },
    });

    const statusMap: Record<number, string> = {
      [SPLITTER_STATUS_NORMAL]: 'normal',
      [SPLITTER_STATUS_FAULT]: 'fault',
      [SPLITTER_STATUS_STOPPED]: 'stopped',
      [SPLITTER_STATUS_UNDER_CONSTRUCTION]: 'under_construction',
    };

    this.logger.log(
      `Splitter ${updated.splitterName} status changed to ${statusMap[status] || 'unknown'} by ${currentUser.account}`,
    );

    return this.formatSplitter(updated);
  }

  async remove(id: string, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const splitter = await this.prisma.opticalSplitter.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!splitter) {
      throw new NotFoundException('分光器不存在');
    }

    // 验证区域权限
    const community = await this.prisma.community.findFirst({
      where: { id: splitter.communityId, isDeleted: 0 },
    });
    if (community) {
      await this.checkRegionAccess(currentUser, community.regionId);
    }

    // 只有停用状态才能删除
    if (splitter.status !== SPLITTER_STATUS_STOPPED) {
      throw new BadRequestException('只有停用状态的分光器才能删除');
    }

    // 检查是否有子节点
    const childCount = await this.prisma.opticalSplitter.count({
      where: { parentId: BigInt(id), isDeleted: 0 },
    });
    if (childCount > 0) {
      throw new BadRequestException(
        `该节点下有 ${childCount} 个子节点，请先删除子节点`,
      );
    }

    await this.prisma.opticalSplitter.update({
      where: { id: BigInt(id) },
      data: { isDeleted: 1, operatorId: BigInt(currentUser.id) },
    });

    this.logger.log(
      `Splitter ${splitter.splitterName} deleted by ${currentUser.account}`,
    );

    return { message: '删除成功' };
  }

  private validateLevel(level: number) {
    const validLevels = [
      SPLITTER_LEVEL_OPTICAL_CROSS,
      SPLITTER_LEVEL_LEVEL1,
      SPLITTER_LEVEL_LEVEL2,
      SPLITTER_LEVEL_CABLE_TERMINAL,
    ];
    if (!validLevels.includes(level)) {
      throw new BadRequestException(`无效的分光器级别: ${level}`);
    }
  }

  private validateStatus(status: number) {
    const validStatuses = [
      SPLITTER_STATUS_NORMAL,
      SPLITTER_STATUS_FAULT,
      SPLITTER_STATUS_STOPPED,
      SPLITTER_STATUS_UNDER_CONSTRUCTION,
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(`无效的分光器状态: ${status}`);
    }
  }

  private async getAllDescendantIds(parentId: bigint): Promise<bigint[]> {
    const result: bigint[] = [];
    const children = await this.prisma.opticalSplitter.findMany({
      where: { parentId, isDeleted: 0 },
      select: { id: true },
    });
    for (const child of children) {
      result.push(child.id);
      const descendants = await this.getAllDescendantIds(child.id);
      result.push(...descendants);
    }
    return result;
  }

  private checkReadPermission(currentUser: RequestUser) {
    if (currentUser.roleType === RoleType.VIEWER) {
      throw new ForbiddenException('查看者无权访问分光器管理');
    }
  }

  private checkWritePermission(currentUser: RequestUser) {
    const allowed = [
      RoleType.SUPER_ADMIN,
      RoleType.REGION_ADMIN,
      RoleType.ADMIN,
      RoleType.OPERATOR,
    ];
    if (!allowed.includes(currentUser.roleType as RoleType)) {
      throw new ForbiddenException('您没有分光器管理写权限');
    }
  }

  private async checkRegionAccess(
    currentUser: RequestUser,
    regionId: bigint,
  ) {
    if (currentUser.roleType === RoleType.SUPER_ADMIN) return;

    const myRegionId = await this.getUserRegionId(currentUser.id);
    if (myRegionId !== regionId) {
      throw new ForbiddenException('无权操作其他区域的资源');
    }
  }

  private async getUserRegionId(userId: string): Promise<bigint> {
    const user = await this.prisma.sysUser.findUnique({
      where: { id: BigInt(userId) },
      select: { regionId: true },
    });
    return user?.regionId ?? BigInt(0);
  }

  private formatSplitter(splitter: {
    id: bigint;
    splitterName: string;
    communityId: bigint;
    splitterLevel: number;
    parentId: bigint | null;
    splitRatio: string | null;
    installLocation: string | null;
    longitude: { toString(): string } | number | null;
    latitude: { toString(): string } | number | null;
    status: number;
    faultType: number | null;
    remark: string | null;
    operatorId: bigint;
    isDeleted: number;
    creatorId: bigint;
    createTime: Date;
    updateTime: Date;
  }) {
    return {
      id: splitter.id.toString(),
      splitterName: splitter.splitterName,
      communityId: splitter.communityId.toString(),
      splitterLevel: splitter.splitterLevel,
      parentId: splitter.parentId ? splitter.parentId.toString() : null,
      splitRatio: splitter.splitRatio,
      installLocation: splitter.installLocation,
      longitude: splitter.longitude ? splitter.longitude.toString() : null,
      latitude: splitter.latitude ? splitter.latitude.toString() : null,
      status: splitter.status,
      faultType: splitter.faultType,
      remark: splitter.remark,
      operatorId: splitter.operatorId.toString(),
      isDeleted: splitter.isDeleted,
      creatorId: splitter.creatorId.toString(),
      createTime: splitter.createTime,
      updateTime: splitter.updateTime,
    };
  }
}
