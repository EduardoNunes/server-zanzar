import { Module } from '@nestjs/common';
import { UsersManagementController } from './users-management.controller';
import { UsersManagementService } from './users-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [UsersManagementController],
  providers: [UsersManagementService],
})
export class UsersManagementModule {}
