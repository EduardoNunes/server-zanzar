import { Module } from '@nestjs/common';
import { StoreService } from './store.service';
import { StoreController } from './store.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [StoreService, PrismaService],
  controllers: [StoreController],
})
export class StoreModule {}
