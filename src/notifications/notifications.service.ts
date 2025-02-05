import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(data: {
    type: string;
    content: string;
    senderId: string;
    receiverId: string;
    referenceId: string;
    referenceUrl: string;
  }) {
    const response = this.prisma.notification.create({
      data: {
        type: data.type,
        content: data.content,
        senderId: data.senderId,
        receiverId: data.receiverId,
        referenceId: data.referenceId,
        referenceUrl: data.referenceUrl,
        isRead: false,
      },
    });

    return response;
  }

  async getNotifications(receiverId: string) {
    console.log("prfileID", receiverId)
    return this.prisma.notification.findMany({
      where: { receiverId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }
}
