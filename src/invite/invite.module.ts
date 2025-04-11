import { Module } from '@nestjs/common';
import { InviteService } from './invite.service';
import { InviteController } from './invite.controller';
import { PrismaService } from '../prisma/prisma.service';
import { InviteGateway } from './invite.gateway';

@Module({
  controllers: [InviteController],
  providers: [PrismaService, InviteService, InviteGateway],
  exports: [InviteService, InviteGateway],
})
export class InviteModule {}
