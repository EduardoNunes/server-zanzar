import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { CountAllNotificationsService } from './count-all-notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly notificationsGateway: NotificationsGateway,
    private readonly countAllNotificationsService: CountAllNotificationsService,
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
  async getNotifications(
    @Param('id') profileId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    console.log("CHEGOU AQUI", profileId, page, limit);
    return this.notificationsService.getNotifications(profileId, page, limit);
  }

  @Post(':id/mark-as-read')
  async markAsRead(@Param('id') notificationId: string) {
    return this.notificationsService.markAsRead(notificationId);
  }

  @Post('mark-all-read/:profileId')
  async markAllAsRead(@Param('profileId') profileId: string) {
    return this.notificationsService.markAllAsRead(profileId);
  }

  @Get('/all-unread-notifications/:profileId')
  async getAllNotifications(@Param('profileId') profileId: string) {
    const notifications =
      await this.countAllNotificationsService.getAllCounts(profileId);
    return notifications;
  }
}
