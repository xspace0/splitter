import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { AssignPermissionDto, RemovePermissionDto } from './dto/assign-permission.dto';
import { QueryPermissionDto } from './dto/query-permission.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('permissions')
export class PermissionController {
  constructor(private readonly permissionService: PermissionService) {}

  @Post('assign')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async assign(
    @Body() dto: AssignPermissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.assign(dto, user);
  }

  @Post('remove')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async remove(
    @Body() dto: RemovePermissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.remove(dto, user);
  }

  @Get('user/:userId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async findByUser(
    @Param('userId') userId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.findByUser(userId, user);
  }

  @Get('community/:communityId')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async findByCommunity(
    @Param('communityId') communityId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.findByCommunity(communityId, user);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async findAssignments(
    @Query() query: QueryPermissionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.permissionService.findAssignments(query, user);
  }
}
