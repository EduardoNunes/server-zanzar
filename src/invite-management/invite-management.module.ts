import { Module } from '@nestjs/common';
import { InviteManagementService } from './invite-management.service';
import { InviteManagementController } from './invite-management.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [InviteManagementService, PrismaService],
  controllers: [InviteManagementController]
})
export class InviteManagementModule {}
