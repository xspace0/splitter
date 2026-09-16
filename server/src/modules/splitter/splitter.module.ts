import { Module } from '@nestjs/common';
import { SplitterService } from './splitter.service';
import { SplitterController } from './splitter.controller';
import { PrismaModule } from '@/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SplitterController],
  providers: [SplitterService],
  exports: [SplitterService],
})
export class SplitterModule {}
