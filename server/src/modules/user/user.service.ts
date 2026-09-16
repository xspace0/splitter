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

    this.validateRolePermission(
      currentUser.roleType,
      dto.roleType,
    );

    if (getRoleLevel(dto.roleType) <= getRoleLevel(RoleType.OPERATOR)) {
      const targetRegionId = dto.regionId ? BigInt(dto.regionId) : null;
      const myRegionId = await this.getUserRegionId(currentUser.id);
      if (currentUser.roleType !== RoleType.SUPER_ADMIN && targetRegionId !== myRegionId) {
        throw new ForbiddenException('只能为本区域用户分配角色');
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const isPcCreatedByAdmin =
      currentUser.roleType === RoleType.SUPER_ADMIN ||
      currentUser.roleType === RoleType.REGION_ADMIN;
    const realNameVerified = isPcCreatedByAdmin ? 1 : 0;

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

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: 'CREATE',
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
      if (currentUser.roleType === RoleType.REGION_ADMIN) {
        where.regionId = myRegionId;
      } else {
        where.regionId = myRegionId;
        where.roleType = { in: [RoleType.OPERATOR, RoleType.VIEWER] };
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

    const data: { username?: string; phone?: string | null; idCardNo?: string | null } = {};
    if (dto.username !== undefined) data.username = dto.username;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.idCardNo !== undefined) data.idCardNo = dto.idCardNo;

    const updated = await this.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data,
    });

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: 'UPDATE',
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

    const updated = await this.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data: { status },
    });

    this.logger.log(`User ${user.account} status=${status} by ${currentUser.account}`);

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: status === 1 ? 'ENABLE' : 'DISABLE',
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

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await this.prisma.sysUser.update({
      where: { id: BigInt(id) },
      data: { passwordHash },
    });

    this.logger.log(`Password reset for ${user.account} by ${currentUser.account}`);

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: 'UPDATE',
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

    this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: 'ROLE_CHANGE',
      targetType: '用户',
      targetId: BigInt(id),
      operationContent: `${user.username}(${user.account}) 角色变更：${user.roleType} → ${newRole}`,
    });

    return this.formatUser(updated);
  }

  private validateRolePermission(
    operatorRole: string,
    targetRole: string,
  ) {
    if (operatorRole === RoleType.SUPER_ADMIN) return;

    if (operatorRole === RoleType.REGION_ADMIN) {
      if (targetRole === RoleType.SUPER_ADMIN || targetRole === RoleType.REGION_ADMIN) {
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
    if (operatorRole === RoleType.SUPER_ADMIN) return;

    this.validateRolePermission(operatorRole, targetRole);
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
