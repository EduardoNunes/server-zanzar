import { Module } from '@nestjs/common';
import { AdvertisementsManagementController } from './advertisements-management.controller';
import { AdvertisementsManagementService } from './advertisements-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdvertisementsManagementController],
  providers: [AdvertisementsManagementService],
})
export class AdvertisementsManagementModule {}
