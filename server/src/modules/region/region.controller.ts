import { Controller, Get, Post, Put, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegionService } from './region.service';
import { CreateRegionDto } from './dto/create-region.dto';
import { UpdateRegionDto } from './dto/update-region.dto';

@ApiTags('行政区划')
@Controller('regions')
export class RegionController {
  constructor(private readonly regionService: RegionService) {}

  @ApiOperation({ summary: '获取树形结构（省-市-区县）' })
  @Get('tree')
  findTree(@Query('parentId') parentId?: string) {
    return this.regionService.findTree(parentId);
  }

  @ApiOperation({ summary: '按级别查询列表' })
  @Get()
  findByLevel(@Query('level') level: string) {
    return this.regionService.findByLevel(parseInt(level));
  }

  @ApiOperation({ summary: '查询子级列表' })
  @Get(':parentId/children')
  findChildren(@Param('parentId') parentId: string) {
    return this.regionService.findChildrenByParent(parentId);
  }

  @ApiOperation({ summary: '获取详情' })
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.regionService.findOne(id);
  }

  @ApiOperation({ summary: '新增行政区划' })
  @Post()
  create(@Body() dto: CreateRegionDto) {
    return this.regionService.create(dto);
  }

  @ApiOperation({ summary: '修改行政区划' })
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRegionDto) {
    return this.regionService.update(id, dto);
  }

  @ApiOperation({ summary: '删除行政区划' })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.regionService.remove(id);
  }
}
