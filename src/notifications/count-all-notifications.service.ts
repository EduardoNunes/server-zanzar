import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CountAllNotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  // Função para contar notificações não lidas, chats não lidos e convites concedidos
  async getAllCounts(profileId: string): Promise<any> {

    // Contando notificações não lidas
    const unreadNotifications = await this.prisma.notification.count({
      where: {
        receiverId: profileId,
        isRead: false,
      },
    });

    // Contando chats não lidos
    const unreadChats = await this.prisma.chatConversation.count({
      where: {
        participants: {
          some: { profileId: profileId },
        },
        messages: {
          some: {
            readStatus: {
              none: { profileId: profileId },
            },
          },
        },
      },
    });

    // Contando convites concedidos
    const profile = await this.prisma.profiles.findUnique({
      where: {
        id: profileId,
      },
      select: {
        invites: true,
      },
    });

    const invitesCount = profile ? profile.invites : 0;

    // Retornando todos os valores juntos em um único objeto
    return {
      unreadNotifications,
      unreadChats,
      invitesCount,
    };
  }
}