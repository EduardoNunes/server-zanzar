import { Module } from '@nestjs/common';
import { PurchasesController } from './purchases.controller';
import { PurchasesService } from './purchases.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [PurchasesService, PrismaService],
  controllers: [PurchasesController],
})
export class PurchasesModule {}
