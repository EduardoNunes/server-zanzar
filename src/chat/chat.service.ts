import {
  Injectable,
  BadRequestException,
  HttpStatus,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async getUsers(userName: string) {
    const formattedUsername = userName
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_');

    try {
      const usersList = await this.prisma.profiles.findMany({
        where: {
          username: {
            contains: formattedUsername,
            mode: 'insensitive',
          },
        },
        take: 5,
      });

      return usersList;
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async getFollowedUsers(profileId: string) {
    try {
      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException(
          'Usuário não encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      const followedProfilesIds = await this.prisma.followers.findMany({
        where: { followerId: profile.id },
        select: { followingId: true },
      });

      const followedIds = followedProfilesIds.map(
        (follow) => follow.followingId,
      );

      const followedProfiles = await this.prisma.profiles.findMany({
        where: { id: { in: followedIds } },
        select: {
          id: true,
          username: true,
          avatarUrl: true,
          role: true,
          createdAt: true,
        },
      });

      return followedProfiles;
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro ao buscar os usuários seguidos',
        error: 'Bad Request',
      });
    }
  }

  async createChat(
    nameChat: string,
    profileId: string,
    selectedProfileId: string
  ) {
    try {
      // Verificar se o perfil do usuário existe
      const profile = await this.prisma.profiles.findUnique({
        where: {
          id: profileId,
        },
      });
  
      if (!profile) {
        throw new HttpException('Usuário não encontrado.', HttpStatus.NOT_FOUND);
      }
  
      // Verificar se já existe um chat entre os dois perfis
      const existingChat = await this.prisma.chatConversation.findFirst({
        where: {
          isGroup: false,
          participants: {
            every: {
              profileId: { in: [profileId, selectedProfileId] },
            },
          },
        },
        include: {
          participants: true,
        },
      });
  
      if (existingChat) {
        return {
          message: 'Chat já existe',
          conversationId: existingChat.id,
        };
      }
  
      // Criar a nova conversa se não existir
      const conversation = await this.prisma.chatConversation.create({
        data: {
          name: nameChat || null,
          isGroup: false,
        },
      });
  
      // Criar participantes da conversa
      const profilesId = [profileId, selectedProfileId];
      const participants = profilesId.map((profileId) =>
        this.prisma.chatParticipants.create({
          data: {
            profileId: profileId,
            conversationId: conversation.id,
          },
        })
      );
  
      await Promise.all(participants);
  
      return {
        message: 'Chat criado com sucesso',
        conversation,
        participants,
      };
    } catch (error) {
      console.error('Erro ao criar o chat:', error);
      throw new BadRequestException('Erro ao criar o chat.');
    }
  }

  async findUserChats(profileId: string) {
    try {
      // Verifica se o perfil do usuário existe
      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException(
          'Usuário não encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      // Busca todas as conversas em que o usuário participa
      const userChats = await this.prisma.chatParticipants.findMany({
        where: { profileId },
        select: {
          conversation: {
            select: {
              id: true,
              name: true,
              isGroup: true,
              createdAt: true,
              participants: {
                select: {
                  profile: {
                    select: {
                      id: true,
                      username: true,
                      avatarUrl: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // Formata os dados para retornar uma estrutura mais clara
      const formattedChats = userChats.map((chatParticipant) => {
        const conversation = chatParticipant.conversation;
        return {
          conversationId: conversation.id,
          name: conversation.name || null,
          isGroup: conversation.isGroup,
          createdAt: conversation.createdAt,
          participants: conversation.participants.map((participant) => ({
            profileId: participant.profile.id,
            username: participant.profile.username,
            avatarUrl: participant.profile.avatarUrl,
          })),
        };
      });

      return formattedChats;
    } catch (error) {
      console.error('Erro ao buscar os chats do usuário:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  // Criar uma nova mensagem
  async createMessage(data: {
    conversationId: string;
    profileId: string;
    content: string;
  }) {
    return this.prisma.chatMessages.create({
      data: {
        content: data.content,
        conversationId: data.conversationId,
        profileId: data.profileId,
      },
    });
  }

  // Marcar mensagem como lida
  async markMessageAsRead(data: { messageId: string; profileId: string }) {
    return this.prisma.chatReadStatus.upsert({
      where: {
        messageId_profileId: {
          messageId: data.messageId,
          profileId: data.profileId,
        },
      },
      update: { readAt: new Date() },
      create: { messageId: data.messageId, profileId: data.profileId },
    });
  }

  // Editar mensagem
  async editMessage(data: { messageId: string; content: string }) {
    return this.prisma.chatMessages.update({
      where: { id: data.messageId },
      data: { content: data.content },
    });
  }

  // Apagar mensagem
  async deleteMessage(messageId: string) {
    return this.prisma.chatMessages.delete({
      where: { id: messageId },
    });
  }

  // Obter mensagens de uma conversa
  async getConversationMessages(conversationId: string) {
    return this.prisma.chatMessages.findMany({
      where: { conversationId },
      include: { profile: true, readStatus: true },
      orderBy: { createdAt: 'asc' },
    });
  }
}
