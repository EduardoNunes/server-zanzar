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

  async getNotifications(
    receiverId: string,
    page: number = 1,
    limit: number = 10,
  ) {
    // Calcular o skip com base na página e limite
    const skip = (page - 1) * limit;

    // Obter o total de notificações para este usuário
    const total = await this.prisma.notification.count({
      where: { receiverId },
    });

    // Obter o total de notificações não lidas
    const unreadCount = await this.prisma.notification.count({
      where: {
        receiverId,
        isRead: false,
      },
    });

    // Obter as notificações paginadas
    const notifications = await this.prisma.notification.findMany({
      where: { receiverId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: Number(limit),
    });

    // Retornar os dados paginados junto com metadados
    return {
      data: notifications,
      meta: {
        total,
        unreadCount,
        page,
        limit,
        hasMore: total > skip + limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(profileId: string) {
    return this.prisma.notification.updateMany({
      where: { receiverId: profileId, isRead: false },
      data: { isRead: true },
    });
  }
}
