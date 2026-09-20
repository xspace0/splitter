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
import { SplitterService } from './splitter.service';
import { CreateSplitterDto } from './dto/create-splitter.dto';
import { UpdateSplitterDto } from './dto/update-splitter.dto';
import { QuerySplitterDto } from './dto/query-splitter.dto';
import {
  UpdateSplitterStatusDto,
  ReportFaultDto,
  UpdateSplitterLevelDto,
} from './dto/update-status.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('splitters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SplitterController {
  constructor(private readonly splitterService: SplitterService) {}

  @Post()
  @Roles(RoleType.SUPER_ADMIN, RoleType.OPERATOR)
  create(
    @Body() dto: CreateSplitterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.create(dto, user);
  }

  @Get()
  findAll(
    @Query() query: QuerySplitterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.findAll(query, user);
  }

  @Get('map-data')
  getMapData(
    @Query() query: QuerySplitterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.getMapData(query, user);
  }

  @Get('stats')
  getStats(@CurrentUser() user: RequestUser) {
    return this.splitterService.getStats(user);
  }

  @Get('tree/:communityId')
  getTree(
    @Param('communityId') communityId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.getTree(BigInt(communityId), user);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.splitterService.findOne(BigInt(id), user);
  }

  @Put(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.OPERATOR)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSplitterDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.update(BigInt(id), dto, user);
  }

  @Post(':id/status')
  @HttpCode(200)
  @Roles(RoleType.SUPER_ADMIN, RoleType.OPERATOR)
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateSplitterStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.updateStatus(
      BigInt(id),
      body.status,
      body.faultType,
      user,
    );
  }

  @Post(':id/report-fault')
  @HttpCode(200)
  @Roles(RoleType.SUPER_ADMIN, RoleType.OPERATOR)
  reportFault(
    @Param('id') id: string,
    @Body() body: ReportFaultDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.updateStatus(BigInt(id), 2, body.faultType, user);
  }

  @Post(':id/recover-fault')
  @HttpCode(200)
  @Roles(RoleType.SUPER_ADMIN, RoleType.OPERATOR)
  recoverFault(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.updateStatus(BigInt(id), 1, undefined, user);
  }

  @Post(':id/level')
  @HttpCode(200)
  @Roles(RoleType.SUPER_ADMIN, RoleType.OPERATOR)
  updateLevel(
    @Param('id') id: string,
    @Body() body: UpdateSplitterLevelDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.splitterService.updateLevel(
      BigInt(id),
      body.splitterLevel,
      user,
    );
  }

  @Delete(':id')
  @Roles(RoleType.SUPER_ADMIN, RoleType.OPERATOR)
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.splitterService.remove(BigInt(id), user);
  }
}
