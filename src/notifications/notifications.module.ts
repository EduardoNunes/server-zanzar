import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { CountAllNotificationsService } from './count-all-notifications.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    CountAllNotificationsService,
  ],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
