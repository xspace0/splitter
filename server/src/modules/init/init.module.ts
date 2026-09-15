import { Module } from '@nestjs/common';
import { InitService } from './init.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [InitService],
})
export class InitModule {}
