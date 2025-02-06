import { Module } from '@nestjs/common';
import { MessagesManagementController } from './messages-management.controller';
import { MessagesManagementService } from './messages-management.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [MessagesManagementController],
  providers: [MessagesManagementService],
})
export class MessagesManagementModule {}
