import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LogService } from '../log/log.service';
import { RoleType, getRoleLevel } from '@/common/enums/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

type UserWithRelations = {
  id: bigint;
  username: string;
  account: string | null;
  passwordHash: string | null;
  roleType: string;
  regionId: bigint | null;
  phone: string | null;
  idCardNo: string | null;
  realNameVerified: number;
  realNameAuthTime: Date | null;
  status: number;
  lastLoginTime: Date | null;
  isDeleted: number;
  creatorId: bigint | null;
  createTime: Date;
  updateTime: Date;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  async create(dto: CreateUserDto, currentUser: RequestUser) {
    const existing = await this.prisma.sysUser.findFirst({
      where: { account: dto.account, isDeleted: 0 },
    });
    if (existing) {
      throw new ConflictException('账号已存在');
    }

    this.validateRolePermission(currentUser.roleType, dto.roleType);

    // 区县归属：非超管只能在本管辖范围内创建账号（区域管理员按其下区县判定）
    await this.validateSameRegion(currentUser, dto.regionId ? BigInt(dto.regionId) : null);

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // PC 端账号由管理员创建时录入姓名与身份证号，视为「创建即认证」（文档 2.1 / 4.1）
    const realNameVerified = 1;

    const user = await this.prisma.sysUser.create({
      data: {
        username: dto.username,
        account: dto.account,
        passwordHash,
        roleType: dto.roleType,
        regionId: dto.regionId ? BigInt(dto.regionId) : null,
        phone: dto.phone || null,
        idCardNo: dto.idCardNo || null,
        realNameVerified,
        realNameAuthTime: realNameVerified ? new Date() : null,
        creatorId: BigInt(currentUser.id),
      },
    });

    this.logger.log(`User created: ${user.account} (role=${user.roleType}) by ${currentUser.account}`);

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '新增',
      targetType: '用户',
      targetId: user.id,
      operationContent: `新增用户 ${user.username}(${user.account})，角色：${user.roleType}`,
    });

    return this.formatUser(user);
  }

  async findAll(query: QueryUserDto, currentUser: RequestUser) {
    const where: Record<string, unknown> = { isDeleted: 0 };

    if (query.keyword) {
      where.OR = [
        { username: { contains: query.keyword, mode: 'insensitive' } },
        { account: { contains: query.keyword, mode: 'insensitive' } },
        { phone: { contains: query.keyword } },
      ];
    }

    if (query.roleType) {
      where.roleType = query.roleType;
    }

    if (query.status !== undefined) {
      where.status = Number(query.status);
    }

    if (currentUser.roleType !== RoleType.SUPER_ADMIN) {
      const myRegionId = await this.getUserRegionId(currentUser.id);
      if (myRegionId === null) {
        throw new ForbiddenException('当前账号未绑定所属区县，无法查询用户列表');
      }
      where.regionId = myRegionId;
      // 区域管理员可管理本区域管理员与查看者；管理员仅可管理本区县操作员与查看者
      if (currentUser.roleType === RoleType.ADMIN) {
        where.roleType = { in: [RoleType.OPERATOR, RoleType.VIEWER] };
      } else if (currentUser.roleType === RoleType.REGION_ADMIN) {
        where.roleType = {
          in: [RoleType.ADMIN, RoleType.OPERATOR, RoleType.VIEWER],
        };
      }
    } else if (query.regionId) {
      where.regionId = BigInt(query.regionId);
    }

    const [total, users] = await Promise.all([
      this.prisma.sysUser.count({ where }),
      this.prisma.sysUser.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createTime: 'desc' },
      }),
    ]);

    return {
      list: users.map((u) => this.formatUser(u)),
      total,
      page: query.page || 1,
      pageSize: query.pageSize || 20,
    };
  }

  async findOne(id: string, currentUser: RequestUser) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    this.validateDataAccess(currentUser.roleType, user.roleType);
    await this.validateSameRegion(currentUser, user.regionId);

    return this.formatUser(user);
  }

  async update(id: string, dto: UpdateUserDto, currentUser: RequestUser) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    this.validateDataAccess(currentUser.roleType, user.roleType);
    await this.validateSameRegion(currentUser, user.regionId);

    const data: { username?: string; phone?: string | null; idCardNo?: string | null } = {};
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.idCardNo !== undefined) data.idCardNo = dto.idCardNo;

    const updated = await this.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data,
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '用户',
      targetId: BigInt(id),
      operationContent: `修改用户信息 ${user.username}(${user.account})`,
    });

    return this.formatUser(updated);
  }

  async updateStatus(id: string, status: number, currentUser: RequestUser) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    this.validateRolePermission(currentUser.roleType, user.roleType);
    await this.validateSameRegion(currentUser, user.regionId);

    if (user.id.toString() === currentUser.id) {
      throw new ForbiddenException('不能修改自己的账号状态');
    }

    const updated = await this.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    this.logger.log(`User ${user.account} status=${status} by ${currentUser.account}`);

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: status === 1 ? '启用' : '禁用',
      targetType: '用户',
      targetId: BigInt(id),
      operationContent: `${status === 1 ? '启用' : '禁用'}用户 ${user.username}(${user.account})`,
    });

    return this.formatUser(updated);
  }

  async resetPassword(id: string, newPassword: string, currentUser: RequestUser) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    this.validateRolePermission(currentUser.roleType, user.roleType);
    await this.validateSameRegion(currentUser, user.regionId);

    if (user.id.toString() === currentUser.id) {
      throw new ForbiddenException('请通过个人中心修改自己的密码');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data: { passwordHash },
    });

    this.logger.log(`Password reset for ${user.account} by ${currentUser.account}`);

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '用户',
      targetId: BigInt(id),
      operationContent: `重置用户 ${user.username}(${user.account}) 密码`,
    });

    return { message: '密码已重置' };
  }

  async updateRole(id: string, newRole: RoleType, currentUser: RequestUser) {
    const user = await this.prisma.sysUser.findFirst({
      where: { id: BigInt(id), isDeleted: 0 },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    this.validateRoleChange(currentUser.roleType, user.roleType, newRole);
    await this.validateSameRegion(currentUser, user.regionId);

    if (user.id.toString() === currentUser.id) {
      throw new ForbiddenException('不能修改自己的角色');
    }

    if (getRoleLevel(newRole) <= getRoleLevel(RoleType.OPERATOR) && !user.realNameVerified) {
      throw new BadRequestException('目标用户尚未完成实名认证，无法提升至操作员及以上角色');
    }

    const updated = await this.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data: { roleType: newRole },
    });

    this.logger.log(
      `User ${user.account} role ${user.roleType} -> ${newRole} by ${currentUser.account}`,
    );

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '角色变更',
      targetType: '用户',
      targetId: BigInt(id),
      operationContent: `${user.username}(${user.account}) 角色变更：${user.roleType} -> ${newRole}`,
    });

    return this.formatUser(updated);
  }

  /**
   * 区县归属校验：非超级管理员只能操作自己管辖范围内的账号。
   * 区域管理员按「市」级节点下辖的区县判定，管理员按本区县判定。
   * 仅校验角色层级不足以防止通过遍历自增 id 跨区县越权。
   */
  private async validateSameRegion(
    currentUser: RequestUser,
    targetRegionId: bigint | null,
  ): Promise<void> {
    if (currentUser.roleType === RoleType.SUPER_ADMIN) return;

    const myRegionId = await this.getUserRegionId(currentUser.id);

    if (myRegionId === null) {
      throw new ForbiddenException('当前账号未绑定所属区县，无法执行该操作');
    }
    if (targetRegionId === null) {
      throw new ForbiddenException('目标账号未绑定区县，无法跨范围操作');
    }
    if (targetRegionId === myRegionId) return;

    if (currentUser.roleType === RoleType.REGION_ADMIN) {
      // 区域管理员绑定市级节点：沿目标区县的祖先链上溯，命中本区域即放行
      let cursor: bigint | null = targetRegionId;
      const visited = new Set<string>();
      for (let depth = 0; depth < 4 && cursor !== null; depth++) {
        const key = cursor.toString();
        if (visited.has(key)) break;
        visited.add(key);

        const region: { parentId: bigint | null } | null =
          await this.prisma.sysRegion.findUnique({
            where: { id: cursor },
            select: { parentId: true },
          });
        if (!region) break;
        if (region.parentId === myRegionId) return;
        cursor = region.parentId;
      }
    }

    throw new ForbiddenException('只能管理本管辖范围内的账号');
  }

  /**
   * 写操作的角色层级校验：
   * - 超管：无限制
   * - 区域管理员：不能操作超管/区域管理员（区域管理员仅由超管创建与管理）
   * - 管理员：不能操作管理员及以上
   */
  private validateRolePermission(
    operatorRole: string,
    targetRole: string,
  ) {
    if (operatorRole === RoleType.SUPER_ADMIN) return;

    if (operatorRole === RoleType.REGION_ADMIN) {
      if (
        targetRole === RoleType.SUPER_ADMIN ||
        targetRole === RoleType.REGION_ADMIN
      ) {
        throw new ForbiddenException('区域管理员无权操作超级管理员或区域管理员账号');
      }
    } else if (operatorRole === RoleType.ADMIN) {
      if (getRoleLevel(targetRole) <= getRoleLevel(RoleType.ADMIN)) {
        throw new ForbiddenException('管理员无权操作管理员及以上账号');
      }
    } else {
      throw new ForbiddenException('无权限执行此操作');
    }
  }

  /**
   * 只读操作的角色层级校验：
   * 区域管理员需要看到本区域内管理员列表（文档 3.1「可见管理员账号列表」），
   * 因此只读场景允许其查看管理员账号。
   */
  private validateRoleVisibility(
    operatorRole: string,
    targetRole: string,
  ) {
    if (operatorRole === RoleType.SUPER_ADMIN) return;

    if (operatorRole === RoleType.REGION_ADMIN) {
      if (targetRole === RoleType.SUPER_ADMIN) {
        throw new ForbiddenException('区域管理员无权查看超级管理员账号');
      }
      return;
    }

    this.validateRolePermission(operatorRole, targetRole);
  }

  private validateRoleChange(
    operatorRole: string,
    oldRole: string,
    newRole: string,
  ) {
    this.validateRolePermission(operatorRole, oldRole);
    this.validateRolePermission(operatorRole, newRole);

    if (operatorRole === RoleType.REGION_ADMIN) {
      const allowed = [RoleType.VIEWER, RoleType.ADMIN];
      if (!allowed.includes(newRole as RoleType)) {
        throw new ForbiddenException('区域管理员只能在查看者与管理员之间切换');
      }
    } else if (operatorRole === RoleType.ADMIN) {
      const allowed = [RoleType.VIEWER, RoleType.OPERATOR];
      if (!allowed.includes(newRole as RoleType)) {
        throw new ForbiddenException('管理员只能在查看者与操作员之间切换');
      }
    }
  }

  private validateDataAccess(
    operatorRole: string,
    targetRole: string,
  ) {
    this.validateRoleVisibility(operatorRole, targetRole);
  }

  private async getUserRegionId(userId: string): Promise<bigint | null> {
    const user = await this.prisma.sysUser.findUnique({
      where: { id: BigInt(userId) },
      select: { regionId: true },
    });
    return user?.regionId ?? null;
  }

  private formatUser(user: UserWithRelations) {
    return {
      id: user.id.toString(),
      username: user.username,
      account: user.account,
      roleType: user.roleType,
      regionId: user.regionId?.toString() ?? null,
      phone: user.phone,
      realNameVerified: user.realNameVerified,
      status: user.status,
      lastLoginTime: user.lastLoginTime,
      createTime: user.createTime,
      updateTime: user.updateTime,
    };
  }
}
