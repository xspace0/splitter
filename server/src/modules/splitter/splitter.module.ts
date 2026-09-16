import { Module } from '@nestjs/common';
import { SplitterService } from './splitter.service';
import { SplitterController } from './splitter.controller';
import { PrismaModule } from '@/prisma/prisma.module';
import { LogModule } from '../log/log.module';

@Module({
  imports: [PrismaModule, LogModule],
  controllers: [SplitterController],
  providers: [SplitterService],
  exports: [SplitterService],
})
export class SplitterModule {}
