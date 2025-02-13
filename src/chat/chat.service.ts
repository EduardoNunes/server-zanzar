import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ChatService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private prisma: PrismaService) { }

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

      for (const profile of followedProfiles) {
        let avatarUrl = profile.avatarUrl;

        if (avatarUrl) {
          const bucketPath = avatarUrl.replace(
            'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/',
            '',
          );

          const { data, error } = await this.supabase.storage
            .from('zanzar-images')
            .createSignedUrl(bucketPath, 3600);

          if (error) {
            throw new BadRequestException(
              `Erro ao gerar URL assinada: ${error.message}`,
            );
          }

          profile.avatarUrl = data?.signedUrl;
        }
      }

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
    selectedProfileId: string,
  ) {
    try {
      // Verificar se o perfil do usuário existe
      const profile = await this.prisma.profiles.findUnique({
        where: {
          id: profileId,
        },
      });

      if (!profile) {
        throw new HttpException(
          'Usuário não encontrado.',
          HttpStatus.NOT_FOUND,
        );
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
        }),
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
      const formattedChats = await Promise.all(
        userChats.map(async (chatParticipant) => {
          const conversation = chatParticipant.conversation;

          // Gerar URLs assinadas para os avatares de todos os participantes
          const participants = await Promise.all(
            conversation.participants.map(async (participant) => {
              let avatarUrl = participant.profile.avatarUrl;

              if (avatarUrl) {
                const bucketPath = avatarUrl.replace(
                  'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/',
                  '',
                );

                const { data, error } = await this.supabase.storage
                  .from('zanzar-images')
                  .createSignedUrl(bucketPath, 3600);

                if (error) {
                  throw new BadRequestException(
                    `Erro ao gerar URL assinada para o avatar de ${participant.profile.username}: ${error.message}`,
                  );
                }

                avatarUrl = data?.signedUrl;
              }

              return {
                profileId: participant.profile.id,
                username: participant.profile.username,
                avatarUrl,
              };
            }),
          );

          return {
            conversationId: conversation.id,
            name: conversation.name || null,
            isGroup: conversation.isGroup,
            createdAt: conversation.createdAt,
            participants,
          };
        }),
      );

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

  // Obter mensagens de uma conversa
  async getConversationMessages(
    conversationId: string,
    limit: number,
    offset: number,
  ) {
    try {
      // Busca as mensagens com paginação
      const messages = await this.prisma.chatMessages.findMany({
        where: { conversationId },
        take: Number(limit),
        skip: Number(offset),
        orderBy: { createdAt: 'desc' },
        include: {
          profile: {
            select: {
              username: true,
              avatarUrl: true,
            },
          },
          readStatus: true,
        },
        // Ordena do mais antigo para o mais recente
      });

      // Processa as mensagens para gerar URLs assinadas
      const processedMessages = await Promise.all(
        messages.map(async (message) => {
          let avatarUrl = message.profile.avatarUrl;
          if (avatarUrl) {
            try {
              const bucketPath = avatarUrl.replace(
                'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/',
                '',
              );
              const { data, error } = await this.supabase.storage
                .from('zanzar-images')
                .createSignedUrl(bucketPath, 3600);

              if (error) {
                console.error(`Erro ao gerar URL assinada: ${error.message}`);
                // Não interrompe o fluxo, apenas mantém a URL original
              } else {
                avatarUrl = data?.signedUrl || avatarUrl;
              }
            } catch (error) {
              console.error(`Erro ao processar avatar: ${error.message}`);
            }
          }

          // Retorna a mensagem com a URL atualizada
          return {
            ...message,
            profile: {
              ...message.profile,
              avatarUrl: avatarUrl,
            },
          };
        }),
      );

      return processedMessages;
    } catch (error) {
      console.error('Erro ao buscar mensagens da conversa:', error);
      throw new BadRequestException(
        'Erro ao buscar ou processar as mensagens.',
      );
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

  async markMessageAsRead(messageId: string, profileId: string) {
    try {
      // Check if the message exists
      const message = await this.prisma.chatMessages.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new HttpException('Mensagem não encontrada', HttpStatus.NOT_FOUND);
      }

      // Check if the profile exists
      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException('Perfil não encontrado', HttpStatus.NOT_FOUND);
      }

      // Create or update read status
      return this.prisma.chatReadStatus.upsert({
        where: {
          messageId_profileId: {
            messageId,
            profileId,
          },
        },
        update: {
          readAt: new Date(),
        },
        create: {
          messageId,
          profileId,
          readAt: new Date(),
        },
      });
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro ao marcar mensagem como lida',
        error: 'Bad Request',
      });
    }
  }

  async markConversationAsRead(conversationId: string, profileId: string) {
    try {
      // Get all unread messages in the conversation for this profile
      const unreadMessages = await this.prisma.chatMessages.findMany({
        where: {
          conversationId,
          readStatus: {
            none: {
              profileId,
              readAt: {
                not: null,
              },
            },
          },
        },
      });

      // Mark each unread message as read
      const readPromises = unreadMessages.map((message) =>
        this.markMessageAsRead(message.id, profileId),
      );

      await Promise.all(readPromises);

      return {
        conversationId,
        profileId,
        messagesMarkedAsRead: unreadMessages.length,
      };
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro ao marcar conversa como lida',
        error: 'Bad Request',
      });
    }
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

  async getUnreadMessagesCount(profileId: string) {
    try {
      // Count unread messages where the profile is not the sender and hasn't read the message
      const unreadCount = await this.prisma.chatMessages.count({
        where: {
          NOT: {
            profileId,
          },
          readStatus: {
            none: {
              profileId,
              readAt: {
                not: null,
              },
            },
          },
        },
      });

      return { count: unreadCount };
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro ao buscar mensagens não lidas',
        error: 'Bad Request',
      });
    }
  }
}
