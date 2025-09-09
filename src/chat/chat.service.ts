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
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  private bucketName = process.env.BUCKET_MIDIAS;

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

      for (const profile of followedProfiles) {
        let avatarUrl = profile.avatarUrl;

        if (avatarUrl) {
          const bucketPath = avatarUrl.replace(
            `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
            '',
          );

          const { data, error } = await this.supabase.storage
            .from(this.bucketName)
            .createSignedUrl(bucketPath, 86400);

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
        include: {
          conversation: {
            include: {
              participants: {
                include: {
                  profile: true, // traz todos os campos do perfil
                },
              },
              _count: {
                select: {
                  messages: {
                    where: { readStatus: { none: { profileId } } }, // mensagens não lidas
                  },
                },
              },
            },
          },
        },
      });

      // Formata os dados para retornar uma estrutura clara
      const formattedChats = await Promise.all(
        userChats.map(async ({ conversation }) => {
          // Gerar URLs assinadas para os avatares dos participantes
          const participants = await Promise.all(
            conversation.participants.map(async ({ profile }) => {
              let avatarUrl = profile.avatarUrl;

              if (avatarUrl) {
                const bucketPath = avatarUrl.replace(
                  `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
                  '',
                );

                const { data, error } = await this.supabase.storage
                  .from(this.bucketName)
                  .createSignedUrl(bucketPath, 86400); // 24h

                if (error) {
                  throw new BadRequestException(
                    `Erro ao gerar URL assinada para o avatar de ${profile.username}: ${error.message}`,
                  );
                }

                avatarUrl = data?.signedUrl;
              }

              return {
                profileId: profile.id,
                username: profile.username,
                avatarUrl,
              };
            }),
          );

          return {
            conversationId: conversation.id,
            name: conversation.name || null,
            isGroup: conversation.isGroup,
            createdAt: conversation.createdAt,
            messagesCount: conversation._count.messages,
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
              id: true,
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
                `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
                '',
              );

              const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .createSignedUrl(bucketPath, 86400);

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
    // Busca o perfil do usuário que está enviando a mensagem
    const profile = await this.prisma.profiles.findUnique({
      where: { id: data.profileId },
      select: {
        avatarUrl: true,
        username: true,
      },
    });

    if (!profile) {
      throw new Error('Perfil não encontrado');
    }

    // Gerar URL assinada para o avatar, se existir.
    if (profile.avatarUrl) {
      const bucketPath = profile.avatarUrl.replace(
        `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
        '',
      );

      const { data: signedUrlData, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(bucketPath, 86400);

      if (error) {
        throw new BadRequestException(
          `Erro ao gerar URL assinada: ${error.message}`,
        );
      }

      profile.avatarUrl = signedUrlData?.signedUrl;
    }

    // Cria a mensagem no banco de dados
    const message = await this.prisma.chatMessages.create({
      data: {
        content: data.content,
        conversationId: data.conversationId,
        profileId: data.profileId,
      },
    });

    // Retorna a mensagem com os dados do perfil incluídos
    return {
      ...message,
      profile: {
        avatarUrl: profile.avatarUrl,
        username: profile.username,
      },
    };
  }

  async markMessageAsRead(messageId: string, profileId: string) {
    try {
      // Check if the message exists
      const message = await this.prisma.chatMessages.findUnique({
        where: { id: messageId },
      });

      if (!message) {
        throw new HttpException(
          'Mensagem não encontrada',
          HttpStatus.NOT_FOUND,
        );
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
      // Obter todas as mensagens não lidas na conversa para este perfil
      const unreadMessages = await this.prisma.chatMessages.findMany({
        where: {
          conversationId,
          readStatus: {
            none: {
              profileId,
            },
          },
        },
      });

      // Marcar cada mensagem não lida como lida
      const readPromises = unreadMessages.map(async (message) => {
        // Verificar se já existe um registro de status de leitura
        const existingReadStatus = await this.prisma.chatReadStatus.findUnique({
          where: {
            messageId_profileId: {
              messageId: message.id,
              profileId,
            },
          },
        });

        // Criar o registro apenas se ele não existir
        if (!existingReadStatus) {
          await this.prisma.chatReadStatus.create({
            data: {
              messageId: message.id,
              profileId,
              readAt: new Date(),
            },
          });
        }
      });

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

  async getMyUnreadMessages(profileId: string) {
    return this.prisma.chatConversation.findMany({
      where: {
        messages: {
          some: {
            readStatus: {
              none: { profileId },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
        isGroup: true,
        _count: {
          select: {
            messages: {
              where: {
                readStatus: {
                  none: { profileId },
                },
              },
            },
          },
        },
      },
    });
  }

  async getConversation(conversationId: string) {
    try {
      const conversation = await this.prisma.chatConversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            select: {
              profileId: true,
            },
          },
        },
      });

      if (!conversation) {
        throw new HttpException(
          'Conversa não encontrada.',
          HttpStatus.NOT_FOUND,
        );
      }

      return conversation;
    } catch (error) {
      console.error('Erro ao buscar conversa:', error);
      throw new BadRequestException('Erro ao buscar conversa.');
    }
  }
}
