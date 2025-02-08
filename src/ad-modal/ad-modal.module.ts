import { Module } from '@nestjs/common';
import { AdModalController } from './ad-modal.controller';
import { AdModalService } from './ad-modal.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdModalController],
  providers: [AdModalService],
})
export class AdModalModule {}