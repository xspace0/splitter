import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { CommunityService } from './community.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { UpdateCommunityDto } from './dto/update-community.dto';
import { QueryCommunityDto } from './dto/query-community.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('communities')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  create(
    @Body() dto: CreateCommunityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.create(dto, user);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  findAll(
    @Query() query: QueryCommunityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.findAll(query, user);
  }

  @Get('my')
  getMyCommunities(@CurrentUser() user: RequestUser) {
    return this.communityService.getMyCommunities(user);
  }

  @Get('map-options')
  getMapCommunityOptions(@CurrentUser() user: RequestUser) {
    return this.communityService.getMapCommunityOptions(user);
  }

  @Get('stats')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  getStats(@CurrentUser() user: RequestUser) {
    return this.communityService.getStats(user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.communityService.findOne(BigInt(id), user);
  }

  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCommunityDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.communityService.update(BigInt(id), dto, user);
  }

  @Post(':id/disable')
  @HttpCode(200)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  disable(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.communityService.disable(BigInt(id), user);
  }

  @Post(':id/enable')
  @HttpCode(200)
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  enable(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.communityService.enable(BigInt(id), user);
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.communityService.remove(BigInt(id), user);
  }
}
