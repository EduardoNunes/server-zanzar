import { Module } from '@nestjs/common';
import { ActivityManagementController } from './activity-management.controller';
import { ActivityManagementService } from './activity-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ActivityManagementController],
  providers: [ActivityManagementService],
})
export class ActivityManagementModule {}
