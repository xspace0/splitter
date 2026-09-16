import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { SplitterService } from './splitter.service';
import { CreateSplitterDto } from './dto/create-splitter.dto';
import { UpdateSplitterDto } from './dto/update-splitter.dto';
import { QuerySplitterDto } from './dto/query-splitter.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('splitters')
export class SplitterController {
  constructor(private readonly splitterService: SplitterService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN, RoleType.OPERATOR)
  async create(
    @Body() dto: CreateSplitterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.create(dto, user);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN, RoleType.OPERATOR)
  async findAll(
    @Query() query: QuerySplitterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.findAll(query, user);
  }

  @Get('tree/:communityId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN, RoleType.OPERATOR)
  async findTree(
    @Param('communityId') communityId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.findTree(communityId, user);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN, RoleType.OPERATOR)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.findOne(id, user);
  }

  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN, RoleType.OPERATOR)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSplitterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.update(id, dto, user);
  }

  @Put(':id/status')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN, RoleType.OPERATOR)
  async updateStatus(
    @Param('id') id: string,
    @Body('status', ParseIntPipe) status: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.updateStatus(id, status, user);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.remove(id, user);
  }
}
