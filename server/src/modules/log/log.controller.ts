import { Controller, Get, Query } from '@nestjs/common';
import { LogService } from './log.service';
import { QueryLogDto } from './dto/query-log.dto';
import { Roles } from '@/common/decorators/roles.decorator';
import { RoleType } from '@/common/enums/role.enum';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { RequestUser } from '../auth/strategies/jwt.strategy';

@Controller('logs')
export class LogController {
  constructor(private readonly logService: LogService) {}

  @Get()
  @Roles(RoleType.SUPER_ADMIN)
  async findMany(
    @Query() query: QueryLogDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.logService.findMany(query, user);
  }
}
