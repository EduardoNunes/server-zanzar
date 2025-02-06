import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MessagesManagementService {
  constructor(private prisma: PrismaService) { }

  async getMessagesTotal() {
    return await this.prisma.chatMessages.count();
  }

  async getMessages24h() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    return await this.prisma.chatMessages.count({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo
        }
      }
    });
  }

  async getMessages7d() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.prisma.chatMessages.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });
  }

  async getMessages30d() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await this.prisma.chatMessages.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });
  }

  async getAllMessages(page: number = 1) {
    const messagesPerPage = 50;
    const skip = (page - 1) * messagesPerPage;

    const [messages, total] = await Promise.all([
      this.prisma.chatMessages.findMany({
        select: {
          id: true,
          content: true,
          createdAt: true,
          profile: {
            select: { username: true }
          },
          conversation: {
            select: {
              participants: {
                select: {
                  profile: {
                    select: { username: true }
                  }
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: messagesPerPage
      }),
      this.prisma.chatMessages.count()
    ]);

    const formattedMessages = messages.map(msg => {
      const senderUsername = msg.profile.username;
      const receivers = msg.conversation.participants
        .map(p => p.profile.username)
        .filter(username => username !== senderUsername); // Remove o remetente da lista de participantes

      return {
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        sender: senderUsername,
        receiver: receivers.length === 1 ? receivers[0] : receivers // Se for grupo, retorna array de usuários
      };
    });

    return {
      messages: formattedMessages,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / messagesPerPage),
        hasMore: page * messagesPerPage < total
      }
    };
  }

}
