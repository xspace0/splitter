import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RoleType } from '@/common/enums/role.enum';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { QueryCommunityDto } from './dto/query-community.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';
import { SplitterService } from '../splitter/splitter.service';

// 业务错误码
const ERR_DUPLICATE = 1003;
const ERR_NO_PERMISSION = 3001;
const ERR_NO_DATA_PERMISSION = 3002;
const ERR_COMMUNITY_DISABLED = 3003;
const ERR_LOGICAL_DELETED = 3004;
const ERR_CANNOT_DELETE = 3011;
const ERR_PARAM = 4001;

function bizError(code: number, message: string, statusCode = 400) {
  const err = new ForbiddenException({ code, message });
  (err as any).status = statusCode;
  return err;
}

@Injectable()
export class CommunityService {
  private readonly logger = new Logger(CommunityService.name);

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
    private splitterService: SplitterService,
  ) {}

  // ========== 权限校验 ==========

  /**
   * 社区管理写权限：超管和管理员可写
   */
  private checkWritePermission(user: RequestUser) {
    if (user.roleType !== RoleType.SUPER_ADMIN && user.roleType !== RoleType.ADMIN) {
      throw bizError(ERR_NO_PERMISSION, '当前角色无社区管理写操作权限', 403);
    }
  }

  /**
   * 社区管理读权限：超管、区域管理员、管理员可读列表
   * 操作员、查看者禁止访问社区管理列表
   */
  private checkReadListPermission(user: RequestUser) {
    if (
      user.roleType === RoleType.OPERATOR ||
      user.roleType === RoleType.VIEWER
    ) {
      throw bizError(ERR_NO_PERMISSION, '当前角色无权限访问社区管理列表', 403);
    }
  }

  /**
   * 构建社区查询的基础where条件
   */
  private buildBaseWhere(user: RequestUser, extraWhere: any = {}): any {
    const where: any = { ...extraWhere };

    // 逻辑删除过滤：超管不过滤，其他角色过滤
    if (user.roleType !== RoleType.SUPER_ADMIN) {
      where.isDeleted = 0;
    }

    // 数据权限
    if (user.roleType === RoleType.REGION_ADMIN) {
      // 区域管理员：本区域全部社区
      // 需要先查出该区域下的所有区县
      // 简化处理：regionId存储的是区县，区域管理员需要用父级region过滤
      // 这里先用用户的regionId，假设区域管理员绑定的是市级region
      where.regionId = BigInt(user.regionId);
    } else if (user.roleType === RoleType.ADMIN) {
      // 管理员：本区县社区
      where.regionId = BigInt(user.regionId);
    }
    // SUPER_ADMIN: 不过滤
    // OPERATOR/VIEWER: 在社区管理列表接口直接拒绝，地图接口另行处理

    return where;
  }

  /**
   * 校验社区名称在未删除状态下唯一
   */
  private async checkNameUnique(communityName: string, excludeId?: bigint) {
    const where: any = {
      communityName,
      isDeleted: 0,
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    const exists = await this.prisma.community.findFirst({ where });
    if (exists) {
      throw bizError(ERR_DUPLICATE, '社区名称已存在', 400);
    }
  }

  /**
   * 校验管理员是否有该区县的权限
   */
  private checkRegionAccess(user: RequestUser, regionId: bigint) {
    if (user.roleType === RoleType.SUPER_ADMIN) return;
    // 区域管理员：需要校验社区所属区县属于本区域
    // 管理员：必须是本区县
    if (
      user.roleType === RoleType.ADMIN &&
      BigInt(user.regionId) !== regionId
    ) {
      throw bizError(ERR_NO_DATA_PERMISSION, '您没有权限操作该区县的社区', 403);
    }
  }

  // ========== CRUD ==========

  async create(dto: CreateCommunityDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    if (!dto.regionId) {
      // 管理员创建时默认本区县
      if (currentUser.roleType === RoleType.ADMIN) {
        dto.regionId = String(currentUser.regionId);
      } else {
        throw bizError(ERR_PARAM, '区县不能为空', 400);
      }
    }

    const regionId = BigInt(dto.regionId);
    this.checkRegionAccess(currentUser, regionId);

    // 名称唯一
    await this.checkNameUnique(dto.communityName);

    const community = await this.prisma.community.create({
      data: {
        communityName: dto.communityName,
        regionId,
        remark: dto.remark || null,
        status: 1,
        creatorId: BigInt(currentUser.id),
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '新增',
      targetType: '社区',
      targetId: community.id,
      operationContent: JSON.stringify({ communityName: dto.communityName }),
    });

    return community;
  }

  async findAll(query: QueryCommunityDto, currentUser: RequestUser) {
    // 社区管理列表：操作员、查看者禁止访问
    this.checkReadListPermission(currentUser);

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = this.buildBaseWhere(currentUser);

    if (query.keyword) {
      where.communityName = { contains: query.keyword };
    }
    if (query.status !== undefined && query.status !== null && query.status !== '') {
      where.status = Number(query.status);
    }
    if (query.regionId) {
      where.regionId = BigInt(query.regionId);
    }

    const [total, list] = await Promise.all([
      this.prisma.community.count({ where }),
      this.prisma.community.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createTime: 'desc' },
        include: {
          region: { select: { id: true, regionName: true, regionLevel: true } },
        },
      } as any),
    ]);

    return { total, list };
  }

  async findOne(id: bigint, currentUser: RequestUser) {
    const where = this.buildBaseWhere(currentUser, { id });

    const community = await this.prisma.community.findFirst({
      where,
      include: {
        region: { select: { id: true, regionName: true, regionLevel: true } },
      },
    } as any);
    if (!community) {
      throw new NotFoundException('社区不存在或无权限访问');
    }

    return community;
  }

  async update(id: bigint, dto: UpdateCommunityDto, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const where = this.buildBaseWhere(currentUser, { id });
    const community = await this.prisma.community.findFirst({ where });
    if (!community) {
      throw new NotFoundException('社区不存在或无权限访问');
    }

    if (community.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该社区已逻辑删除，禁止写操作', 403);
    }

    // 停用社区禁止编辑（全部角色）
    if (community.status === 0) {
      throw bizError(ERR_COMMUNITY_DISABLED, '社区已停用，禁止执行编辑操作', 403);
    }

    this.checkRegionAccess(currentUser, community.regionId);

    // 名称唯一校验
    if (dto.communityName && dto.communityName !== community.communityName) {
      await this.checkNameUnique(dto.communityName, id);
    }

    const updateData: any = {};
    if (dto.communityName !== undefined) updateData.communityName = dto.communityName;
    if (dto.remark !== undefined) updateData.remark = dto.remark || null;

    const updated = await this.prisma.community.update({
      where: { id },
      data: updateData,
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '社区',
      targetId: id,
      operationContent: JSON.stringify(dto),
    });

    return updated;
  }

  /**
   * 停用社区
   */
  async disable(id: bigint, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const where = this.buildBaseWhere(currentUser, { id });
    const community = await this.prisma.community.findFirst({ where });
    if (!community) {
      throw new NotFoundException('社区不存在或无权限访问');
    }

    if (community.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该社区已逻辑删除', 403);
    }

    if (community.status === 0) {
      throw bizError(ERR_PARAM, '社区已是停用状态', 400);
    }

    this.checkRegionAccess(currentUser, community.regionId);

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        status: 0,
        disableTime: new Date(),
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '社区',
      targetId: id,
      operationContent: JSON.stringify({ action: '停用', communityName: community.communityName }),
    });

    return updated;
  }

  /**
   * 恢复启用社区
   */
  async enable(id: bigint, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const where = this.buildBaseWhere(currentUser, { id });
    const community = await this.prisma.community.findFirst({ where });
    if (!community) {
      throw new NotFoundException('社区不存在或无权限访问');
    }

    if (community.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该社区已逻辑删除', 403);
    }

    if (community.status === 1) {
      throw bizError(ERR_PARAM, '社区已是正常状态', 400);
    }

    this.checkRegionAccess(currentUser, community.regionId);

    const updated = await this.prisma.community.update({
      where: { id },
      data: {
        status: 1,
        disableTime: null,
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '社区',
      targetId: id,
      operationContent: JSON.stringify({ action: '恢复启用', communityName: community.communityName }),
    });

    return updated;
  }

  async remove(id: bigint, currentUser: RequestUser) {
    this.checkWritePermission(currentUser);

    const where = this.buildBaseWhere(currentUser, { id });
    const community = await this.prisma.community.findFirst({ where });
    if (!community) {
      throw new NotFoundException('社区不存在或无权限访问');
    }

    if (community.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该社区已是逻辑删除状态', 403);
    }

    this.checkRegionAccess(currentUser, community.regionId);

    // 前置条件1：社区必须是停用状态
    if (community.status !== 0) {
      throw bizError(ERR_CANNOT_DELETE, '社区不满足删除条件，需先停用且停用满30天', 400);
    }

    // 前置条件2：停用时间必须满30天
    if (!community.disableTime) {
      throw bizError(ERR_CANNOT_DELETE, '社区不满足删除条件，停用时间记录异常', 400);
    }
    const disableDate = new Date(community.disableTime);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - disableDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 30) {
      throw bizError(
        ERR_CANNOT_DELETE,
        `社区不满足删除条件，需停用满30天（当前已停用${diffDays}天）`,
        400,
      );
    }

    // 执行逻辑删除
    await this.prisma.community.update({
      where: { id },
      data: { isDeleted: 1 },
    });

    // 批量逻辑删除下属分光器
    const deletedCount = await this.splitterService.batchDeleteByCommunity(
      id,
      BigInt(currentUser.id),
    );

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '删除',
      targetType: '社区',
      targetId: id,
      operationContent: JSON.stringify({
        communityName: community.communityName,
        deletedSplitterCount: deletedCount,
        remark: '社区逻辑删除，下属分光器已批量逻辑删除',
      }),
    });

    return { success: true, deletedSplitterCount: deletedCount };
  }

  /**
   * 操作员获取已分配的社区列表
   */
  async getMyCommunities(currentUser: RequestUser) {
    if (currentUser.roleType !== RoleType.OPERATOR) {
      return { list: [], total: 0 };
    }

    const records = await this.prisma.sysUserCommunity.findMany({
      where: {
        userId: BigInt(currentUser.id),
        status: 1,
        isDeleted: 0,
      },
      include: {
        community: {
          where: { isDeleted: 0 },
          include: {
            region: { select: { id: true, regionName: true } },
          },
        },
      },
      orderBy: { createTime: 'desc' },
    } as any);

    const list = records
      .filter((r: any) => r.community !== null)
      .map((r: any) => ({
        ...(r.community as object),
        assignedTime: r.createTime,
      }));

    return { list, total: list.length };
  }

  /**
   * 地图社区下拉选项
   * - VIEWER: 返回本区县全部有效社区（is_deleted=0）
   * - OPERATOR: 返回已分配社区
   * - ADMIN/REGION_ADMIN/SUPER_ADMIN: 返回对应范围的社区
   * 停用社区正常返回，前端置灰
   */
  async getMapCommunityOptions(currentUser: RequestUser) {
    if (currentUser.roleType === RoleType.OPERATOR) {
      // 操作员：已分配社区
      const result = await this.getMyCommunities(currentUser);
      return { list: result.list };
    }

    const where: any = { isDeleted: 0 };

    if (
      currentUser.roleType === RoleType.VIEWER ||
      currentUser.roleType === RoleType.ADMIN
    ) {
      // 查看者/管理员：本区县
      where.regionId = BigInt(currentUser.regionId);
    } else if (currentUser.roleType === RoleType.REGION_ADMIN) {
      // 区域管理员：本区域
      where.regionId = BigInt(currentUser.regionId);
    }
    // SUPER_ADMIN: 全部

    const list = await this.prisma.community.findMany({
      where,
      select: {
        id: true,
        communityName: true,
        status: true,
        regionId: true,
      },
      orderBy: { communityName: 'asc' },
    });

    return { list };
  }

  /**
   * 社区统计（超管、区域管理员、管理员可查看）
   */
  async getStats(currentUser: RequestUser) {
    if (
      currentUser.roleType === RoleType.OPERATOR ||
      currentUser.roleType === RoleType.VIEWER
    ) {
      throw bizError(ERR_NO_PERMISSION, '当前角色无权限查看社区统计', 403);
    }

    const where = this.buildBaseWhere(currentUser);

    const all = await this.prisma.community.findMany({
      where,
      select: { status: true },
    });

    return {
      total: all.length,
      active: all.filter(c => c.status === 1).length,
      disabled: all.filter(c => c.status === 0).length,
    };
  }
}
