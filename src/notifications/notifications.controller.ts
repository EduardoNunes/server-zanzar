import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  @Post()
  async createNotification(@Body() data: any) {
    const notification =
      await this.notificationsService.createNotification(data);
    this.notificationsGateway.sendNotificationToUser(
      data.receiverId,
      notification,
    );
    return notification;
  }

  @Get('read-all/:id')
  async getNotifications(@Param('id') profileId: string) {
    return this.notificationsService.getNotifications(profileId);
  }

  @Post(':id/mark-as-read')
  async markAsRead(@Param('id') notificationId: string) {
    return this.notificationsService.markAsRead(notificationId);
  }
}
