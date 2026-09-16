import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUserDto } from './dto/query-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: RequestUser) {
    return this.userService.create(dto, user);
  }

  @Get()
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async findAll(@Query() query: QueryUserDto, @CurrentUser() user: RequestUser) {
    return this.userService.findAll(query, user);
  }

  @Get(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.userService.findOne(id, user);
  }

  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.userService.update(id, dto, user);
  }

  @Put(':id/status')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body('status', ParseIntPipe) status: number,
    @CurrentUser() user: RequestUser,
  ) {
    return this.userService.updateStatus(id, status, user);
  }

  @Put(':id/password')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.userService.resetPassword(id, dto.newPassword, user);
  }

  @Put(':id/role')
  @Roles(RoleType.SUPER_ADMIN, RoleType.REGION_ADMIN, RoleType.ADMIN)
  async updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.userService.updateRole(id, dto.roleType, user);
  }
}
