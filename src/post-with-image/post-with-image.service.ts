import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from 'src/notifications/notifications.gateway';

@Injectable()
export class PostsService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  private bucketName = process.env.BUCKET_MIDIAS;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async createPostWithMedia(
    file: Express.Multer.File,
    filePath: string,
    profileId: string,
    caption: string,
    selectedCategory: string,
    order: number,
  ) {
    try {
      const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png'];
      const allowedVideoTypes = ['video/mp4'];

      if (
        !allowedImageTypes.includes(file.mimetype) &&
        !allowedVideoTypes.includes(file.mimetype)
      ) {
        throw new HttpException(
          'Formato de arquivo não suportado. Apenas JPG, JPEG, PNG e MP4 são permitidos.',
          HttpStatus.BAD_REQUEST,
        );
      }

      /*       if (!order) {
        throw new HttpException(
          'É necessário escolher uma ordem.',
          HttpStatus.NOT_FOUND,
        );
      } */

      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException(
          'Usuário não encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from(this.bucketName)
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
          });

      if (uploadError) {
        throw new HttpException(
          `Erro ao fazer upload da imagem: ${uploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const { data: publicUrlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(uploadData?.path);

      const mediaUrl = publicUrlData?.publicUrl;

      if (!mediaUrl) {
        throw new HttpException(
          'Erro ao obter URL pública da imagem.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Create the post
      const newPost = await this.prisma.posts.create({
        data: {
          profileId: profile.id,
          mediaUrl,
          caption,
          isPublic: true,
          categoryId: selectedCategory,
          order: 1,
        },
      });

      // Increment totalPosts for the profile
      await this.prisma.profiles.update({
        where: { id: profileId },
        data: {
          totalPosts: { increment: 1 },
        },
      });

      return newPost;
    } catch (error) {
      console.error('Erro ao criar post:', error);
      throw new HttpException(
        `Erro ao criar o post. ${error.message}.`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllPosts(loggedInProfileId: string, page: number, limit: number) {
    try {
      const profileId = await this.prisma.profiles.findUnique({
        select: { id: true },
        where: { id: loggedInProfileId },
      });

      if (!profileId) {
        throw new HttpException('Perfil não encontrado.', HttpStatus.NOT_FOUND);
      }

      // Calcula o número de registros a pular
      const skip = (page - 1) * limit;

      // Busca os posts com paginação
      const posts = await this.prisma.posts.findMany({
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: Number(limit),
        select: {
          id: true,
          mediaUrl: true,
          caption: true,
          createdAt: true,
          likesCount: true,
          commentsCount: true,
          profile: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
        },
      });

      // Processa os posts para gerar URLs assinadas
      const postsWithSignedUrls = await Promise.all(
        posts.map(async (post) => {
          try {
            let signedMediaUrl = null;
            let signedAvatarUrl = null;

            if (post.mediaUrl) {
              const mediaPath = post.mediaUrl.replace(
                `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
                '',
              );
              const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .createSignedUrl(mediaPath, 3600);
              if (error) {
                console.error(
                  `Erro ao gerar URL assinada para o post ${post.id}:`,
                  error,
                );
              } else {
                signedMediaUrl = data.signedUrl;
              }
            }

            if (post.profile.avatarUrl) {
              const avatarPath = post.profile.avatarUrl.replace(
                `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
                '',
              );
              const { data, error } = await this.supabase.storage
                .from(this.bucketName)
                .createSignedUrl(avatarPath, 3600);
              if (error) {
                console.error(
                  `Erro ao gerar URL assinada para o avatar do perfil:`,
                  error,
                );
              } else {
                signedAvatarUrl = data.signedUrl;
              }
            }

            const likedByLoggedInUser = await this.prisma.likes.findFirst({
              where: {
                postId: post.id,
                profileId: profileId?.id,
              },
            });

            return {
              id: post.id,
              mediaUrl: signedMediaUrl,
              caption: post.caption,
              createdAt: post.createdAt,
              profile: {
                profileId: post.profile.id,
                username: post.profile.username,
                ...(signedAvatarUrl && { avatarUrl: signedAvatarUrl }),
              },
              likedByLoggedInUser: likedByLoggedInUser ? true : false,
              likeCount: post.likesCount,
              commentCount: post.commentsCount,
            };
          } catch (error) {
            console.error(`Erro ao processar o post ${post.id}:`, error);
            return {
              id: post.id,
              mediaUrl: null,
              caption: post.caption,
              createdAt: post.createdAt,
              profile: {
                profileId: post.profile.id,
                username: post.profile.username,
              },
              likedByLoggedInUser: false,
              likeCount: post.likesCount,
              commentCount: post.commentsCount,
            };
          }
        }),
      );

      return postsWithSignedUrls;
    } catch (error) {
      console.error('Erro ao buscar os posts:', error);
      throw new HttpException(
        'Erro ao buscar os posts. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async handleLike(data: any) {
    const { postId, profileId } = data;

    try {
      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException(
          'Perfil não encontrado faça login com um usuário válido.',
          HttpStatus.NOT_FOUND,
        );
      }

      const existingLike = await this.prisma.likes.findFirst({
        where: {
          postId,
          profileId: profile.id,
        },
      });

      if (existingLike) {
        const newLike = await this.prisma.$transaction([
          this.prisma.likes.delete({
            where: {
              id: existingLike.id,
            },
          }),

          this.prisma.posts.update({
            where: {
              id: postId,
            },
            data: {
              likesCount: {
                decrement: 1,
              },
            },
          }),
        ]);

        return {
          message: 'Like removido com sucesso',
          postId,
          likesCount: newLike[1].likesCount,
          likedByLoggedInUser: false,
          profileId: profile.id,
        };
      } else {
        const newLike = await this.prisma.$transaction([
          this.prisma.likes.create({
            data: {
              postId,
              profileId: profile.id,
            },
          }),

          this.prisma.posts.update({
            where: {
              id: postId,
            },
            data: {
              likesCount: {
                increment: 1,
              },
            },
          }),
        ]);

        // Encontra o autor da postagem
        const post = await this.prisma.posts.findUnique({
          where: { id: postId },
          include: { profile: true },
        });

        if (post.profileId !== profile.id) {
          // Cria uma notificação para o autor da postagem
          const notification = {
            type: 'like',
            content: `${profile.username} curtiu sua postagem.`,
            senderId: profile.id,
            receiverId: post.profileId,
            referenceId: postId,
            referenceUrl: `/posts/${postId}`,
          };

          // Envia a notificação via gateway
          this.notificationsGateway.sendNotificationToUser(
            post.profileId,
            notification,
          );
        }

        return {
          message: 'Like registrado com sucesso',
          likeId: newLike[0].id,
          postId: newLike[0].postId,
          profileId: newLike[0].profileId,
          likesCount: newLike[1].likesCount,
          likedByLoggedInUser: true,
        };
      }
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async addComments(data: any) {
    const { postId, profileId, content } = data;

    try {
      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException(
          'Perfil não encontrado faça login com um usuário válido.',
          HttpStatus.NOT_FOUND,
        );
      }

      const newComment = await this.prisma.$transaction([
        this.prisma.comments.create({
          data: {
            postId,
            profileId: profile.id,
            content,
          },
        }),

        this.prisma.posts.update({
          where: { id: postId },
          data: {
            commentsCount: {
              increment: 1,
            },
          },
        }),
      ]);

      const post = await this.prisma.posts.findUnique({
        where: { id: postId },
        include: { profile: true },
      });

      if (post.profileId !== profile.id) {
        // Cria uma notificação para o autor da postagem
        const notification = {
          type: 'comment',
          content: `${profile.username} comentou na sua postagem.`,
          senderId: profile.id,
          receiverId: post.profileId,
          referenceId: postId,
          referenceUrl: `/posts/${postId}`,
        };

        // Envia a notificação via gateway
        this.notificationsGateway.sendNotificationToUser(
          post.profileId,
          notification,
        );
      }

      return {
        message: 'Comentário registrado com sucesso',
        content: newComment[0].content,
        postId: newComment[0].postId,
        profileId: newComment[0].profileId,
        createdAt: newComment[0].createdAt,
        commentsCount: newComment[1].commentsCount,
      };
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async get15comments(postId: string, page: number = 1) {
    const commentsPerPage = 15;

    try {
      const post = await this.prisma.posts.findUnique({
        where: { id: postId },
      });

      if (!post) {
        throw new BadRequestException('Post não encontrado.');
      }

      const skip = (page - 1) * commentsPerPage;

      const comments = await this.prisma.comments.findMany({
        where: { postId },
        skip,
        take: commentsPerPage,
        include: {
          profile: {
            select: {
              username: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return comments;
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async findSinglePost(postId: string, profileId: string) {
    try {
      // Verifica se o perfil logado existe
      const profile = await this.prisma.profiles.findUnique({
        select: { id: true },
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException('Perfil não encontrado.', HttpStatus.NOT_FOUND);
      }

      // Busca o post com os dados essenciais
      const post = await this.prisma.posts.findUnique({
        where: { id: postId },
        select: {
          id: true,
          mediaUrl: true,
          caption: true,
          createdAt: true,
          profile: {
            select: {
              id: true,
              username: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              likes: true,
              comments: true,
            },
          },
        },
      });

      if (!post) {
        throw new HttpException('Post não encontrado.', HttpStatus.NOT_FOUND);
      }

      // Verifica se o usuário logado curtiu o post
      const like = await this.prisma.likes.findFirst({
        where: {
          postId: post.id,
          profileId: profile.id,
        },
        select: { id: true },
      });

      const likedByLoggedInUser = !!like;

      // Geração da URL assinada da imagem do post
      let signedMediaUrl: string | null = null;
      if (post.mediaUrl) {
        const mediaPath = post.mediaUrl.replace(
          `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
          '',
        );

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(mediaPath, 3600);

        if (!error && data?.signedUrl) {
          signedMediaUrl = data.signedUrl;
        } else {
          console.error('Erro ao gerar URL assinada do post:', error);
        }
      }

      // Geração da URL assinada do avatar do autor do post
      let signedAvatarUrl: string | null = null;
      if (post.profile.avatarUrl) {
        const avatarPath = post.profile.avatarUrl.replace(
          `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
          '',
        );

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(avatarPath, 3600);

        if (!error && data?.signedUrl) {
          signedAvatarUrl = data.signedUrl;
        } else {
          console.error('Erro ao gerar URL assinada do avatar:', error);
        }
      }

      // Retorna os dados organizados
      return {
        id: post.id,
        mediaUrl: signedMediaUrl,
        caption: post.caption,
        createdAt: post.createdAt,
        profile: {
          profileId: post.profile.id,
          username: post.profile.username,
          avatarUrl: signedAvatarUrl,
        },
        likedByLoggedInUser,
        likeCount: post._count.likes,
        commentCount: post._count.comments,
      };
    } catch (error) {
      console.error(`Erro ao buscar o post com ID ${postId}:`, error);
      throw new HttpException(
        'Erro ao buscar o post. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loadCategories(profileId: string) {
    try {
      const categories = await this.prisma.categories.findMany({
        where: { profileId },
      });

      return categories;
    } catch (error) {
      console.error(`Erro ao carregar categorias:`, error);
      throw new HttpException(
        'Erro ao carregar categorias. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async addCategory(newCategory: string, profileId: string) {
    try {
      const category = await this.prisma.categories.create({
        data: {
          profileId,
          categories: newCategory,
        },
      });

      return category;
    } catch (error) {
      console.error(`Erro ao criar categoria:`, error);
      throw new HttpException(
        'Erro ao criar categoria. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
