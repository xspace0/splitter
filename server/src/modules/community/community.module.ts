import { Module, forwardRef } from '@nestjs/common';
import { CommunityService } from './community.service';
import { CommunityController } from './community.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { LogModule } from '../log/log.module';
import { SplitterModule } from '../splitter/splitter.module';

@Module({
  // CommunityService 依赖 SplitterService（社区删除时批量逻辑删除下属分光器），
  // 必须显式导入 SplitterModule，否则启动时 DI 解析失败。
  // 使用 forwardRef 以兼容潜在的模块级循环引用。
  imports: [PrismaModule, LogModule, forwardRef(() => SplitterModule)],
  controllers: [CommunityController],
  providers: [CommunityService],
  exports: [CommunityService],
})
export class CommunityModule {}
