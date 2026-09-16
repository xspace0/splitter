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
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { QueryCommunityDto } from './dto/query-community.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('communities')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async create(
    @Body() dto: CreateCommunityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.create(dto, user);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async findAll(
    @Query() query: QueryCommunityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.findAll(query, user);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.findOne(id, user);
  }

  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.update(id, dto, user);
  }

  @Put(':id/status')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body('status', ParseIntPipe) status: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.updateStatus(id, status, user);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.remove(id, user);
  }
}
