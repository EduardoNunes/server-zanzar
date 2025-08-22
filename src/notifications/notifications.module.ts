import { Module } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { CountAllNotificationsService } from './count-all-notifications.service';
import { WebSocketModule } from 'src/common/websocket/websocket.module';


@Module({
  imports: [WebSocketModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    CountAllNotificationsService,
  ],
  exports: [NotificationsGateway],
})
export class NotificationsModule {}
