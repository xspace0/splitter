import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegionService } from './region.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@ApiTags('行政区划')
@Controller('regions')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  /** 行政区划查询允许的角色（写操作仅超级管理员） */
  private static readonly READ_ROLES = [
    RoleType.SUPER_ADMIN,
    RoleType.REGION_ADMIN,
    RoleType.ADMIN,
  ];

  @ApiOperation({ summary: '获取树形结构（省-市-区县）' })
  @Get('tree')
  @Roles(...RegionController.READ_ROLES)
  findTree(@Query('parentId') parentId?: string) {
    return this.regionService.findTree(parentId);
  }

  @ApiOperation({ summary: '按级别查询列表' })
  @Get()
  @Roles(...RegionController.READ_ROLES)
  findByLevel(@Query('level') level: string) {
    return this.regionService.findByLevel(parseInt(level));
  }

  @ApiOperation({ summary: '查询子级列表' })
  @Get(':parentId/children')
  @Roles(...RegionController.READ_ROLES)
  findChildren(@Param('parentId') parentId: string) {
    return this.regionService.findChildrenByParent(parentId);
  }

  @ApiOperation({ summary: '获取详情' })
  @Get(':id')
  @Roles(...RegionController.READ_ROLES)
  findOne(@Param('id') id: string) {
    return this.regionService.findOne(id);
  }

  @ApiOperation({ summary: '新增行政区划（仅超级管理员）' })
  @Post()
  @Roles(RoleType.SUPER_ADMIN)
  create(@Body() dto: CreateRegionDto, @CurrentUser() user: RequestUser) {
    return this.regionService.create(dto, user);
  }

  @ApiOperation({ summary: '修改行政区划（仅超级管理员）' })
  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateRegionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.regionService.update(id, dto, user);
  }

  @ApiOperation({ summary: '删除行政区划（仅超级管理员）' })
  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.regionService.remove(id, user);
  }
}
