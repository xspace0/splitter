import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { LogService } from '../log/log.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

const levelMap: Record<number, string> = { 1: 'PROVINCE', 2: 'CITY', 3: 'DISTRICT' };

@Injectable()
export class RegionService {
  private readonly logger = new Logger(RegionService.name);

  constructor(
    private prisma: PrismaService,
    private logService: LogService,
  ) {}

  // 获取树形结构
  async findTree(parentId?: string): Promise<any[]> {
    const where: any = { parentId: null };
    if (parentId) {
      where.parentId = BigInt(parentId);
    } else {
      where.parentId = null;
      where.regionLevel = 'PROVINCE';
    }

    const regions = await this.prisma.sysRegion.findMany({
      where,
      orderBy: { id: 'asc' },
    });

    return Promise.all(
      regions.map(async (r) => ({
        id: r.id.toString(),
        regionName: r.regionName,
        parentId: r.parentId?.toString() || null,
        regionLevel: r.regionLevel,
        regionCode: r.regionCode,
        children: await this.findChildren(r.id.toString()),
      })),
    );
  }

  private async findChildren(parentId: string): Promise<any[]> {
    const children = await this.prisma.sysRegion.findMany({
      where: { parentId: BigInt(parentId) },
      orderBy: { id: 'asc' },
    });

    if (children.length === 0) return [];

    return Promise.all(
      children.map(async (c) => ({
        id: c.id.toString(),
        regionName: c.regionName,
        parentId: c.parentId?.toString() || null,
        regionLevel: c.regionLevel,
        regionCode: c.regionCode,
        children: await this.findChildren(c.id.toString()),
      })),
    );
  }

  // 按级别查询列表
  async findByLevel(level: number) {
    const levelEnum = levelMap[level];
    if (!levelEnum) throw new BadRequestException('级别参数错误');

    const list = await this.prisma.sysRegion.findMany({
      where: { regionLevel: levelEnum as any },
      orderBy: { id: 'asc' },
    });

    return list.map((r) => this.formatRegion(r));
  }

  // 查询子级列表
  async findChildrenByParent(parentId: string) {
    const list = await this.prisma.sysRegion.findMany({
      where: { parentId: BigInt(parentId) },
      orderBy: { id: 'asc' },
    });

    return list.map((r) => this.formatRegion(r));
  }

  async findOne(id: string) {
    const region = await this.prisma.sysRegion.findUnique({
      where: { id: BigInt(id) },
    });

    if (!region) throw new NotFoundException('行政区划不存在');
    return this.formatRegion(region);
  }

  async create(dto: CreateRegionDto, currentUser: RequestUser) {
    if (dto.regionLevel < 1 || dto.regionLevel > 3) {
      throw new BadRequestException('级别只能是1(省)/2(市)/3(区县)');
    }

    const levelEnum = levelMap[dto.regionLevel];

    // 验证父级
    if (dto.parentId) {
      const parent = await this.prisma.sysRegion.findUnique({
        where: { id: BigInt(dto.parentId) },
      });
      if (!parent) throw new BadRequestException('父级行政区划不存在');
      if (dto.regionLevel !== this.levelToNumber(parent.regionLevel) + 1) {
        throw new BadRequestException('子级级别必须比父级低一级');
      }
    } else {
      if (dto.regionLevel !== 1) {
        throw new BadRequestException('顶级只能是省级');
      }
    }

    // 验证同级别名称唯一
    const exist = await this.prisma.sysRegion.findFirst({
      where: {
        regionName: dto.regionName,
        parentId: dto.parentId ? BigInt(dto.parentId) : null,
      },
    });
    if (exist) throw new BadRequestException('同级下已存在相同名称的行政区划');

    const region = await this.prisma.sysRegion.create({
      data: {
        regionName: dto.regionName,
        parentId: dto.parentId ? BigInt(dto.parentId) : null,
        regionLevel: levelEnum as any,
        regionCode: dto.regionCode,
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '新增',
      targetType: '权限',
      targetId: region.id,
      operationContent: `新增行政区划：${region.regionName}（${this.levelName(dto.regionLevel)}）`,
    });

    return this.formatRegion(region);
  }

  async update(id: string, dto: UpdateRegionDto, currentUser: RequestUser) {
    const region = await this.prisma.sysRegion.findUnique({
      where: { id: BigInt(id) },
    });
    if (!region) throw new NotFoundException('行政区划不存在');

    const updated = await this.prisma.sysRegion.update({
      where: { id: BigInt(id) },
      data: {
        regionName: dto.regionName,
        regionCode: dto.regionCode,
      },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '修改',
      targetType: '权限',
      targetId: updated.id,
      operationContent: `修改行政区划：${updated.regionName}`,
    });

    return this.formatRegion(updated);
  }

  async remove(id: string, currentUser: RequestUser) {
    const region = await this.prisma.sysRegion.findUnique({
      where: { id: BigInt(id) },
    });
    if (!region) throw new NotFoundException('行政区划不存在');

    // 检查是否有子级
    const childCount = await this.prisma.sysRegion.count({
      where: { parentId: BigInt(id) },
    });
    if (childCount > 0) {
      throw new BadRequestException(`该区域下有 ${childCount} 个子级区划，请先删除子级`);
    }

    // 检查是否有关联用户
    const userCount = await this.prisma.sysUser.count({
      where: { regionId: BigInt(id), isDeleted: 0 },
    });
    if (userCount > 0) {
      throw new BadRequestException(`该区域下有 ${userCount} 个用户，请先调整用户所属区域`);
    }

    // 检查是否有关联社区
    const communityCount = await this.prisma.community.count({
      where: { regionId: BigInt(id), isDeleted: 0 },
    });
    if (communityCount > 0) {
      throw new BadRequestException(`该区域下有 ${communityCount} 个社区，请先处理社区`);
    }

    await this.prisma.sysRegion.delete({
      where: { id: BigInt(id) },
    });

    await this.logService.log({
      userId: BigInt(currentUser.id),
      operationType: '删除',
      targetType: '权限',
      targetId: BigInt(id),
      operationContent: `删除行政区划：${region.regionName}`,
    });

    return { message: '删除成功' };
  }

  private formatRegion(r: any) {
    return {
      id: r.id.toString(),
      regionName: r.regionName,
      parentId: r.parentId?.toString() || null,
      regionLevel: r.regionLevel,
      regionCode: r.regionCode,
    };
  }

  private levelToNumber(level: string): number {
    const map: Record<string, number> = { PROVINCE: 1, CITY: 2, DISTRICT: 3 };
    return map[level] || 0;
  }

  private levelName(level: number): string {
    const map: Record<number, string> = { 1: '省', 2: '市', 3: '区县' };
    return map[level] || '未知';
  }
}
