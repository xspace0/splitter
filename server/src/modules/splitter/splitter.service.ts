import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { LogService } from '../log/log.service';
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

// 故障类型枚举（与数据库设计文档一致：1-无光 2-光大 3-箱体损坏 4-拆移改）
const FAULT_TYPES = [1, 2, 3, 4] as const;
const SPLITTER_STATUSES = [
  SPLITTER_STATUS_NORMAL,
  SPLITTER_STATUS_FAULT,
  SPLITTER_STATUS_STOPPED,
  SPLITTER_STATUS_UNDER_CONSTRUCTION,
] as const;

// 分路比枚举
const SPLIT_RATIOS = ['1:8', '1:16', '1:32', '1:64'] as const;

// 业务错误码
const ERR_DUPLICATE = 1003;
const ERR_NO_PERMISSION = 3001;
const ERR_NO_DATA_PERMISSION = 3002;
const ERR_COMMUNITY_DISABLED = 3003;
const ERR_LOGICAL_DELETED = 3004;
const ERR_TOPOLOGY_COMMUNITY = 3005;
const ERR_PARENT_HAS_CHILDREN = 3006;
const ERR_OPERATOR_NO_COMMUNITY = 3007;
const ERR_TOPOLOGY_LEVEL = 3008;
const ERR_CYCLE = 3009;
const ERR_FAULT_TYPE_REQUIRED = 3010;
const ERR_CANNOT_MODIFY_LEVEL = 3012;
const ERR_FAULT_TYPE_FORBIDDEN = 3013;
const ERR_PARAM = 4001;

function bizError(code: number, message: string, statusCode = 400) {
  const err = new ForbiddenException({ code, message });
  (err as any).status = statusCode;
  return err;
}

@Injectable()
export class SplitterService {
  private readonly logger = new Logger(SplitterService.name);

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  // ========== 权限校验 ==========

  /**
   * 写权限校验：只有超管和操作员可写分光器
   * 区域管理员、管理员、查看者均无分光器写权限
   */
  private checkWritePermission(user: RequestUser) {
    if (user.roleType !== RoleType.SUPER_ADMIN && user.roleType !== RoleType.OPERATOR) {
      throw bizError(ERR_NO_PERMISSION, '当前角色无分光器写操作权限', 403);
    }
  }

  /**
   * 读权限校验：
   * - SUPER_ADMIN: 全部可读
   * - REGION_ADMIN / ADMIN / VIEWER: 本区县可读
   * - OPERATOR: 分配社区可读
   */
  private checkReadPermission(user: RequestUser) {
    // 所有角色都有读取权限（VIEWER也可通过地图/拓扑树查看）
    // 数据过滤在查询时通过 where 条件实现
    return true;
  }

  /**
   * 获取操作员已分配的社区ID列表
   */
  private async getOperatorCommunityIds(userId: bigint): Promise<bigint[]> {
    const records = await this.prisma.sysUserCommunity.findMany({
      where: {
        userId,
        status: 1,
        isDeleted: 0,
      },
      select: { communityId: true },
    });
    return records.map(r => r.communityId);
  }

  /**
   * 构建分光器查询的基础 where 条件（含数据权限、逻辑删除过滤）
   */
  private async buildBaseWhere(user: RequestUser, extraWhere: any = {}): Promise<any> {
    const where: any = { ...extraWhere };

    // 逻辑删除过滤：超管不过滤，其他角色过滤
    if (user.roleType !== RoleType.SUPER_ADMIN) {
      where.isDeleted = 0;
    }

    // 数据权限：统一通过 communityId in 方式过滤
    if (user.roleType === RoleType.OPERATOR) {
      // 操作员：仅已分配社区下的分光器
      const communityIds = await this.getOperatorCommunityIds(BigInt(user.id));
      where.communityId = { in: communityIds };
    } else if (
      user.roleType === RoleType.REGION_ADMIN ||
      user.roleType === RoleType.ADMIN ||
      user.roleType === RoleType.VIEWER
    ) {
      // 区域管理员/管理员/查看者：本区县未删除社区
      const regionId = this.parseRegionId(user);
      const regionCommunities = await this.prisma.community.findMany({
        where: { regionId, isDeleted: 0 },
        select: { id: true },
      });
      const ids = regionCommunities.map((c: any) => c.id);
      where.communityId = { in: ids };
    }
    // SUPER_ADMIN: 不过滤

    return where;
  }

  /**
   * 解析并校验 token 中的 regionId，避免 BigInt('') 抛 SyntaxError 变成 500
   */
  private parseRegionId(user: RequestUser): bigint {
    const raw = user.regionId;
    if (!raw || !/^\d+$/.test(raw)) {
      throw bizError(ERR_NO_DATA_PERMISSION, '当前账号未绑定所属区县，无法确定数据范围，请重新登录', 403);
    }
    return BigInt(raw);
  }

  /**
   * 将扁平分光器列表组装为父子拓扑树
   * 父节点不在结果集内（跨社区或已删除）时按根节点处理，避免节点丢失
   */
  private buildTree<T extends { id: bigint; parentId: bigint | null }>(
    rows: T[],
  ): (T & { children: any[] })[] {
    type Node = T & { children: Node[] };
    const nodeMap = new Map<string, Node>();
    for (const row of rows) {
      nodeMap.set(row.id.toString(), { ...row, children: [] });
    }
    const roots: Node[] = [];
    for (const row of rows) {
      const node = nodeMap.get(row.id.toString())!;
      const parent = row.parentId ? nodeMap.get(row.parentId.toString()) : undefined;
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  /**
   * 校验社区状态：停用社区禁止写操作（全部角色含超管）
   */
  private async checkCommunityWritable(communityId: bigint) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { status: true, isDeleted: true, communityName: true },
    });
    if (!community) {
      throw new NotFoundException('社区不存在');
    }
    if (community.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该社区已逻辑删除，禁止写操作', 403);
    }
    if (community.status === 0) {
      throw bizError(ERR_COMMUNITY_DISABLED, '社区已停用，禁止执行写操作', 403);
    }
  }

  /**
   * 校验操作员是否有该社区的写权限
   */
  private async checkOperatorCommunityWrite(userId: bigint, communityId: bigint) {
    const record = await this.prisma.sysUserCommunity.findFirst({
      where: {
        userId,
        communityId,
        status: 1,
        isDeleted: 0,
      },
    });
    if (!record) {
      throw bizError(ERR_NO_DATA_PERMISSION, '您没有权限操作该社区下的分光器资源', 403);
    }
  }

  /**
   * 写操作的完整权限校验（四重）
   */
  private async validateWriteAccess(user: RequestUser, communityId: bigint) {
    // 1. 角色写权限
    this.checkWritePermission(user);
    // 2. 社区停用校验（全部角色）
    await this.checkCommunityWritable(communityId);
    // 3. 操作员社区分配校验
    if (user.roleType === RoleType.OPERATOR) {
      await this.checkOperatorCommunityWrite(BigInt(user.id), communityId);
    }
  }

  // ========== 拓扑校验 ==========

  /**
   * 校验父设备级别与当前级别是否匹配
   */
  private validateParentLevel(level: number, parentLevel: number | null) {
    if (level === SPLITTER_LEVEL_OPTICAL_CROSS) {
      if (parentLevel !== null) {
        throw bizError(ERR_TOPOLOGY_LEVEL, '光交设备不能有父设备', 400);
      }
      return;
    }
    if (parentLevel === null) {
      throw bizError(ERR_TOPOLOGY_LEVEL, '非光交设备必须指定父设备', 400);
    }
    // 一级分光器父必须是光交
    if (level === SPLITTER_LEVEL_LEVEL1 && parentLevel !== SPLITTER_LEVEL_OPTICAL_CROSS) {
      throw bizError(ERR_TOPOLOGY_LEVEL, '一级分光器的父设备必须是光交', 400);
    }
    // 二级分光器父必须是一级
    if (level === SPLITTER_LEVEL_LEVEL2 && parentLevel !== SPLITTER_LEVEL_LEVEL1) {
      throw bizError(ERR_TOPOLOGY_LEVEL, '二级分光器的父设备必须是一级分光器', 400);
    }
    // 光缆成端父必须是二级
    if (level === SPLITTER_LEVEL_CABLE_TERMINAL && parentLevel !== SPLITTER_LEVEL_LEVEL2) {
      throw bizError(ERR_TOPOLOGY_LEVEL, '光缆成端的父设备必须是二级分光器', 400);
    }
  }

  /**
   * 检查是否有未删除子节点
   */
  private async hasUndeletedChildren(id: bigint): Promise<boolean> {
    const count = await this.prisma.opticalSplitter.count({
      where: { parentId: id, isDeleted: 0 },
    });
    return count > 0;
  }

  /**
   * 检查父链是否成环（沿 parent_id 向上追溯，重复访问即判定为环）
   *
   * @param selfId  当前被校验的设备 id；创建场景设备尚未落库，传 undefined（不存在自引用可能）
   * @param parentId 待挂载的父设备 id
   */
  private async checkCycle(parentId: bigint, selfId?: bigint) {
    let currentId: bigint | null = parentId;
    const visited = new Set<string>();
    while (currentId !== null) {
      const key = currentId.toString();
      if (visited.has(key)) {
        throw bizError(ERR_CYCLE, '检测到分光器循环挂载', 400);
      }
      visited.add(key);
      if (selfId !== undefined && currentId === selfId) {
        throw bizError(ERR_CYCLE, '检测到分光器循环挂载', 400);
      }
      const parent: any = await this.prisma.opticalSplitter.findUnique({
        where: { id: currentId },
        select: { parentId: true },
      });
      if (!parent) break;
      currentId = parent.parentId;
    }
  }

  /**
   * 校验名称在社区内唯一（未删除状态下）
   */
  private async checkNameUniqueInCommunity(
    splitterName: string,
    communityId: bigint,
    excludeId?: bigint,
  ) {
    const where: any = {
      splitterName,
      communityId,
      isDeleted: 0,
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    const exists = await this.prisma.opticalSplitter.findFirst({ where });
    if (exists) {
      throw bizError(ERR_DUPLICATE, '分光器名称在该社区内已存在', 400);
    }
  }

  /**
   * 校验状态与 faultType 的一致性
   */
  private validateStatusAndFaultType(status: number, faultType?: number | null) {
    if (!SPLITTER_STATUSES.includes(status as any)) {
      throw bizError(ERR_PARAM, '分光器状态取值非法（1-正常 2-故障 3-停用 4-建设中）', 400);
    }
    if (status === SPLITTER_STATUS_FAULT) {
      if (!faultType) {
        throw bizError(ERR_FAULT_TYPE_REQUIRED, '故障状态必须填写故障类型', 400);
      }
      if (!FAULT_TYPES.includes(faultType as any)) {
        throw bizError(ERR_PARAM, '故障类型取值非法（1-无光 2-光大 3-箱体损坏 4-拆移改）', 400);
      }
    } else {
      // 非故障状态禁止保留 faultType
      if (faultType !== undefined && faultType !== null) {
        throw bizError(ERR_FAULT_TYPE_FORBIDDEN, '非故障状态禁止保留故障类型', 400);
      }
    }
  }

  /**
   * 校验设备级别取值
   */
  private validateSplitterLevel(level: number) {
    if (![1, 2, 3, 4].includes(Number(level))) {
      throw bizError(ERR_PARAM, '设备级别取值非法（1-光交 2-一级 3-二级 4-光缆成端）', 400);
    }
  }

  /**
   * 校验分路比取值（级别1-3必填且必须在枚举内，级别4必须为空）
   */
  private validateSplitRatio(level: number, splitRatio?: string | null) {
    if (level === SPLITTER_LEVEL_CABLE_TERMINAL) {
      if (splitRatio) {
        throw bizError(ERR_PARAM, '光缆成端不允许设置分路比', 400);
      }
      return;
    }
    if (!splitRatio) {
      throw bizError(ERR_PARAM, '光交、一级、二级分光器必须设置分路比', 400);
    }
    if (!SPLIT_RATIOS.includes(splitRatio as any)) {
      throw bizError(ERR_PARAM, '分路比取值非法（1:8 / 1:16 / 1:32 / 1:64）', 400);
    }
  }

  // ========== CRUD ==========

  async create(dto: CreateSplitterDto, currentUser: RequestUser) {
    const communityId = BigInt(dto.communityId);

    // 设备级别取值校验
    this.validateSplitterLevel(dto.splitterLevel);

    // 写操作权限校验（四重）
    await this.validateWriteAccess(currentUser, communityId);

    // 操作员无任何社区分配时禁止写
    if (currentUser.roleType === RoleType.OPERATOR) {
      const ids = await this.getOperatorCommunityIds(BigInt(currentUser.id));
      if (ids.length === 0) {
        throw bizError(ERR_OPERATOR_NO_COMMUNITY, '操作员暂无有效社区分配记录，无法执行写操作', 400);
      }
    }

    // 名称社区内唯一
    await this.checkNameUniqueInCommunity(dto.splitterName, communityId);

    // 验证父设备
    let parent: any = null;
    if (dto.parentId) {
      parent = await this.prisma.opticalSplitter.findFirst({
        where: { id: BigInt(dto.parentId), isDeleted: 0 },
      });
      if (!parent) {
        throw new NotFoundException('父设备不存在');
      }
      // 父子必须同社区
      if (parent.communityId !== communityId) {
        throw bizError(ERR_TOPOLOGY_COMMUNITY, '分光器父子归属社区不一致', 400);
      }
      // 级别匹配
      this.validateParentLevel(dto.splitterLevel, parent.splitterLevel);
      // 循环引用：沿父链上溯，检测是否存在环
      await this.checkCycle(parent.id);
    } else {
      // 无父设备，必须是光交
      this.validateParentLevel(dto.splitterLevel, null);
    }

    // 分路比校验：级别1-3必填且在枚举内，级别4必须为空
    this.validateSplitRatio(dto.splitterLevel, dto.splitRatio);

    // 状态与faultType校验（新建默认正常，不允许直接建为故障）
    const status = dto.status || SPLITTER_STATUS_NORMAL;
    if (status === SPLITTER_STATUS_FAULT) {
      throw bizError(ERR_PARAM, '新增分光器不能直接设为故障状态', 400);
    }
    this.validateStatusAndFaultType(status, null);

    const splitter = await this.prisma.opticalSplitter.create({
      data: {
        splitterName: dto.splitterName,
        communityId,
        splitterLevel: dto.splitterLevel,
        parentId: dto.parentId ? BigInt(dto.parentId) : null,
        splitRatio: dto.splitRatio || null,
        installLocation: dto.installLocation || null,
        longitude: dto.longitude ? parseFloat(dto.longitude) : null,
        latitude: dto.latitude ? parseFloat(dto.latitude) : null,
        status,
        faultType: null,
        remark: dto.remark || null,
        operatorId: BigInt(currentUser.id),
        creatorId: BigInt(currentUser.id),
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '新增',
      targetType: '分光器',
      targetId: splitter.id,
      operationContent: JSON.stringify({ splitterName: dto.splitterName }),
    });

    return splitter;
  }

  async findAll(query: QuerySplitterDto, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where = await this.buildBaseWhere(currentUser);

    if (query.keyword) {
      where.splitterName = { contains: query.keyword };
    }
    if (query.communityId) {
      where.communityId = BigInt(query.communityId);
    }
    if (query.splitterLevel !== undefined && query.splitterLevel !== null) {
      where.splitterLevel = Number(query.splitterLevel);
    }
    if (query.status !== undefined && query.status !== null) {
      where.status = Number(query.status);
    }

    const [total, list] = await Promise.all([
      this.prisma.opticalSplitter.count({ where }),
      this.prisma.opticalSplitter.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createTime: 'desc' },
        include: {
          community: { select: { id: true, communityName: true, status: true } },
        },
      } as any),
    ]);

    // 补全父设备名称（父节点可能不在当前分页结果内）
    const parentIds = [...new Set(
      list.map((s: any) => s.parentId).filter((id: any): id is bigint => id !== null && id !== undefined),
    )];
    const parents = parentIds.length
      ? await this.prisma.opticalSplitter.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, splitterName: true, splitterLevel: true, isDeleted: true },
        })
      : [];
    const parentMap = new Map(parents.map((p) => [p.id.toString(), p]));

    return {
      total,
      list: list.map((s: any) => {
        const parent = s.parentId ? parentMap.get(s.parentId.toString()) : undefined;
        return {
          ...s,
          parentName: parent?.splitterName ?? null,
          parentLevel: parent?.splitterLevel ?? null,
        };
      }),
    };
  }

  /**
   * 拓扑树查询：按社区返回「光交 → 一级 → 二级 → 光缆成端」树形结构
   * 数据权限与列表接口完全一致（复用 buildBaseWhere）
   */
  async getTree(communityId: bigint, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    // 社区可读性校验：与分光器同源的数据权限规则
    const where = await this.buildBaseWhere(currentUser, { communityId });
    if (where.communityId && typeof where.communityId === 'object' && 'in' in where.communityId) {
      const allowed: bigint[] = where.communityId.in;
      if (!allowed.some((id) => id === communityId)) {
        throw bizError(ERR_NO_DATA_PERMISSION, '您没有权限查看该社区的拓扑树', 403);
      }
    } else {
      // 超级管理员：仍校验社区真实存在
      const exists = await this.prisma.community.findUnique({
        where: { id: communityId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('社区不存在');
      }
    }

    const splitters = await this.prisma.opticalSplitter.findMany({
      where,
      orderBy: [{ splitterLevel: 'asc' }, { id: 'asc' }],
      include: {
        community: { select: { id: true, communityName: true, status: true } },
      },
    } as any);

    return this.buildTree(splitters as any);
  }

  async findOne(id: bigint, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const where = await this.buildBaseWhere(currentUser, { id });

    const splitter = await this.prisma.opticalSplitter.findFirst({
      where,
      include: {
        community: { select: { id: true, communityName: true, status: true } },
      },
    } as any);
    if (!splitter) {
      throw new NotFoundException('分光器不存在或无权限访问');
    }

    // 查询父设备信息
    let parent: any = null;
    if (splitter.parentId) {
      parent = await this.prisma.opticalSplitter.findUnique({
        where: { id: splitter.parentId },
        select: { id: true, splitterName: true, splitterLevel: true },
      });
    }

    return { ...splitter, parent };
  }

  async update(id: bigint, dto: UpdateSplitterDto, currentUser: RequestUser) {
    // 先查出来，同时验证权限
    const where = await this.buildBaseWhere(currentUser, { id });
    const splitter = await this.prisma.opticalSplitter.findFirst({ where });
    if (!splitter) {
      throw new NotFoundException('分光器不存在或无权限访问');
    }

    // 逻辑删除禁止写
    if (splitter.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该记录为逻辑删除数据，禁止写操作', 403);
    }

    // 写权限校验（含社区停用校验）
    await this.validateWriteAccess(currentUser, splitter.communityId);

    // 名称唯一校验
    if (dto.splitterName && dto.splitterName !== splitter.splitterName) {
      await this.checkNameUniqueInCommunity(dto.splitterName, splitter.communityId, id);
    }

    // 父设备变更校验
    let newParentId = splitter.parentId;
    if (dto.parentId !== undefined) {
      newParentId = dto.parentId ? BigInt(dto.parentId) : null;
      if (newParentId !== splitter.parentId) {
        if (newParentId !== null) {
          const newParent = await this.prisma.opticalSplitter.findFirst({
            where: { id: newParentId, isDeleted: 0 },
          });
          if (!newParent) {
            throw new NotFoundException('父设备不存在');
          }
          // 父子同社区
          if (newParent.communityId !== splitter.communityId) {
            throw bizError(ERR_TOPOLOGY_COMMUNITY, '分光器父子归属社区不一致', 400);
          }
          // 级别匹配
          this.validateParentLevel(splitter.splitterLevel, newParent.splitterLevel);
          // 循环引用：沿新父链上溯，检测是否回到自身
          await this.checkCycle(newParentId, id);
        } else {
          // 父设备改为空，必须是光交
          this.validateParentLevel(splitter.splitterLevel, null);
        }
      }
    }

    const updateData: any = {};
    if (dto.splitterName !== undefined) updateData.splitterName = dto.splitterName;
    if (dto.parentId !== undefined) updateData.parentId = newParentId;
    if (dto.splitRatio !== undefined) {
      // 分路比变更需按当前级别校验枚举与必填规则
      this.validateSplitRatio(splitter.splitterLevel, dto.splitRatio);
      updateData.splitRatio = dto.splitRatio || null;
    }
    if (dto.installLocation !== undefined) updateData.installLocation = dto.installLocation || null;
    if (dto.longitude !== undefined) updateData.longitude = dto.longitude ? parseFloat(dto.longitude) : null;
    if (dto.latitude !== undefined) updateData.latitude = dto.latitude ? parseFloat(dto.latitude) : null;
    if (dto.remark !== undefined) updateData.remark = dto.remark || null;
    updateData.operatorId = BigInt(currentUser.id);

    const updated = await this.prisma.opticalSplitter.update({
      where: { id },
      data: updateData,
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '分光器',
      targetId: id,
      operationContent: JSON.stringify(dto),
    });

    return updated;
  }

  /**
   * 修改分光器状态（故障上报/恢复、停用/启用、建设中等）
   */
  async updateStatus(id: bigint, status: number, faultType?: number, currentUser?: RequestUser) {
    if (!currentUser) {
      throw bizError(ERR_NO_PERMISSION, '未登录', 401);
    }

    // 先查出来
    const where = await this.buildBaseWhere(currentUser, { id });
    const splitter = await this.prisma.opticalSplitter.findFirst({ where });
    if (!splitter) {
      throw new NotFoundException('分光器不存在或无权限访问');
    }

    // 逻辑删除禁止写
    if (splitter.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该记录为逻辑删除数据，禁止写操作', 403);
    }

    // 写权限校验（含社区停用校验）
    await this.validateWriteAccess(currentUser, splitter.communityId);

    // 状态与 faultType 一致性校验（含状态取值、故障类型枚举校验）
    this.validateStatusAndFaultType(status, status === SPLITTER_STATUS_FAULT ? faultType : null);

    const updateData: any = {
      status,
      operatorId: BigInt(currentUser.id),
    };

    // 非故障状态必须清空 faultType
    if (status !== SPLITTER_STATUS_FAULT) {
      updateData.faultType = null;
    } else {
      updateData.faultType = faultType;
    }

    const updated = await this.prisma.opticalSplitter.update({
      where: { id },
      data: updateData,
    });

    // 记录操作日志
    const opType =
      status === SPLITTER_STATUS_FAULT ? '故障上报' : status === SPLITTER_STATUS_NORMAL && splitter.status === SPLITTER_STATUS_FAULT ? '故障恢复' : '修改';
    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: opType,
      targetType: '分光器',
      targetId: id,
      operationContent: JSON.stringify({ fromStatus: splitter.status, toStatus: status, faultType }),
    });

    return updated;
  }

  async remove(id: bigint, currentUser: RequestUser) {
    // 先查出来
    const where = await this.buildBaseWhere(currentUser, { id });
    const splitter = await this.prisma.opticalSplitter.findFirst({ where });
    if (!splitter) {
      throw new NotFoundException('分光器不存在或无权限访问');
    }

    // 逻辑删除禁止写
    if (splitter.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该记录已为逻辑删除状态', 403);
    }

    // 写权限校验
    await this.validateWriteAccess(currentUser, splitter.communityId);

    // 存在未删除子节点禁止删除
    const hasChildren = await this.hasUndeletedChildren(id);
    if (hasChildren) {
      throw bizError(ERR_PARENT_HAS_CHILDREN, '父分光器下还存在未删除的子分光器，不能删除父分光器', 400);
    }

    await this.prisma.opticalSplitter.update({
      where: { id },
      data: {
        isDeleted: 1,
        operatorId: BigInt(currentUser.id),
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '删除',
      targetType: '分光器',
      targetId: id,
      operationContent: JSON.stringify({ splitterName: splitter.splitterName }),
    });

    return { success: true };
  }

  /**
   * 修改分光器设备级别
   */
  async updateLevel(id: bigint, newLevel: number, currentUser: RequestUser) {
    // 设备级别取值校验
    this.validateSplitterLevel(newLevel);

    const where = await this.buildBaseWhere(currentUser, { id });
    const splitter = await this.prisma.opticalSplitter.findFirst({ where });
    if (!splitter) {
      throw new NotFoundException('分光器不存在或无权限访问');
    }

    if (splitter.isDeleted === 1) {
      throw bizError(ERR_LOGICAL_DELETED, '该记录为逻辑删除数据，禁止写操作', 403);
    }

    await this.validateWriteAccess(currentUser, splitter.communityId);

    // 存在未删除子节点禁止修改级别
    const hasChildren = await this.hasUndeletedChildren(id);
    if (hasChildren) {
      throw bizError(ERR_CANNOT_MODIFY_LEVEL, '该分光器下还存在子设备，不允许修改设备级别', 400);
    }

    // 校验新级别与父设备的匹配
    if (splitter.parentId) {
      const parent = await this.prisma.opticalSplitter.findUnique({
        where: { id: splitter.parentId },
        select: { splitterLevel: true },
      });
      if (parent) {
        this.validateParentLevel(newLevel, parent.splitterLevel);
      }
    } else {
      this.validateParentLevel(newLevel, null);
    }

    // 级别变更后分路比约束随之变化：改为光缆成端需清空，改回1-3级需补全
    const nextSplitRatio = newLevel === SPLITTER_LEVEL_CABLE_TERMINAL ? null : splitter.splitRatio;
    this.validateSplitRatio(newLevel, nextSplitRatio);

    const updated = await this.prisma.opticalSplitter.update({
      where: { id },
      data: {
        splitterLevel: newLevel,
        splitRatio: nextSplitRatio,
        operatorId: BigInt(currentUser.id),
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '分光器',
      targetId: id,
      operationContent: JSON.stringify({
        fromLevel: splitter.splitterLevel,
        toLevel: newLevel,
        remark: '修改设备级别',
      }),
    });

    return updated;
  }

  /**
   * 地图数据查询（和列表接口一样的数据权限，前端用地图组件渲染）
   */
  async getMapData(query: QuerySplitterDto, currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const where = await this.buildBaseWhere(currentUser);

    if (query.communityId) {
      where.communityId = BigInt(query.communityId);
    }
    if (query.splitterLevel !== undefined && query.splitterLevel !== null) {
      where.splitterLevel = Number(query.splitterLevel);
    }
    if (query.status !== undefined && query.status !== null) {
      where.status = Number(query.status);
    }

    // 只取有经纬度的
    where.AND = [{ longitude: { not: null } }, { latitude: { not: null } }];

    const list = await this.prisma.opticalSplitter.findMany({
      where,
      orderBy: { createTime: 'desc' },
      select: {
        id: true,
        splitterName: true,
        communityId: true,
        splitterLevel: true,
        parentId: true,
        splitRatio: true,
        installLocation: true,
        longitude: true,
        latitude: true,
        status: true,
        faultType: true,
      },
    });

    return { list };
  }

  /**
   * 统计数据（按状态分组）
   */
  async getStats(currentUser: RequestUser) {
    this.checkReadPermission(currentUser);

    const where = await this.buildBaseWhere(currentUser);

    const all = await this.prisma.opticalSplitter.findMany({
      where,
      select: { status: true },
    });

    const stats = {
      total: all.length,
      normal: all.filter(s => s.status === SPLITTER_STATUS_NORMAL).length,
      fault: all.filter(s => s.status === SPLITTER_STATUS_FAULT).length,
      stopped: all.filter(s => s.status === SPLITTER_STATUS_STOPPED).length,
      building: all.filter(s => s.status === SPLITTER_STATUS_UNDER_CONSTRUCTION).length,
    };

    return stats;
  }

  /**
   * 批量逻辑删除指定社区下的所有分光器（社区删除时调用）
   */
  async batchDeleteByCommunity(communityId: bigint, operatorId: bigint) {
    const splitters = await this.prisma.opticalSplitter.findMany({
      where: { communityId, isDeleted: 0 },
      select: { id: true, splitterName: true },
    });

    if (splitters.length === 0) return 0;

    await this.prisma.opticalSplitter.updateMany({
      where: { communityId, isDeleted: 0 },
      data: { isDeleted: 1, operatorId },
    });

    // 批量写操作日志
    for (const s of splitters) {
      await this.logService.log({
        userId: operatorId,
        operationType: '删除',
        targetType: '分光器',
        targetId: s.id,
        operationContent: JSON.stringify({
          splitterName: s.splitterName,
          reason: '因所属社区删除，批量逻辑删除',
        }),
      });
    }

    return splitters.length;
  }
}
