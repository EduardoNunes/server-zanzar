import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';
import { create } from 'domain';

@Injectable()
export class PostsService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private readonly prisma: PrismaService) {}

  async createPostWithMedia(
    file: Express.Multer.File,
    filePath: string,
    profileId: string,
    caption: string,
  ) {
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

      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from('zanzar-images')
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
        .from('zanzar-images')
        .getPublicUrl(uploadData?.path);

      const mediaUrl = publicUrlData?.publicUrl;

      if (!mediaUrl) {
        throw new HttpException(
          'Erro ao obter URL pública da imagem.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const newPost = await this.prisma.posts.create({
        data: {
          profileId: profile.id,
          mediaUrl,
          caption,
          isPublic: true,
        },
      });

      return newPost;
    } catch (error) {
      console.error('Erro ao criar post:', error);
      throw new HttpException(
        'Erro ao criar o post. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAllPosts(loggedInProfileId: string) {
    try {
      const profileId = await this.prisma.profiles.findUnique({
        select: { id: true },
        where: { id: loggedInProfileId },
      });

      const posts = await this.prisma.posts.findMany({
        orderBy: {
          createdAt: 'desc',
        },
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
          likes: {
            select: {
              id: true,
              profile: {
                select: {
                  id: true,
                  username: true,
                },
              },
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

      const postsWithSignedUrls = await Promise.all(
        posts.map(async (post) => {
          try {
            let signedMediaUrl = null;
            let signedAvatarUrl = null;

            if (post.mediaUrl) {
              const mediaPath = post.mediaUrl.replace(
                'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/zanzar-images/',
                '',
              );

              const { data, error } = await this.supabase.storage
                .from('zanzar-images')
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
                'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/',
                '',
              );

              const { data, error } = await this.supabase.storage
                .from('zanzar-images')
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

            const likedByLoggedInUser = post.likes.some(
              (like) => like.profile.id === profileId?.id,
            );

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
              likedByLoggedInUser,
              likeCount: post._count.likes,
              commentCount: post._count.comments,
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
              likeCount: post._count.likes,
              commentCount: post._count.comments,
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
        await this.prisma.likes.delete({
          where: {
            id: existingLike.id,
          },
        });

        return {
          message: 'Like removido com sucesso',
          postId,
          profileId: profile.id,
        };
      } else {
        const newLike = await this.prisma.likes.create({
          data: {
            postId,
            profileId: profile.id,
          },
        });

        return {
          message: 'Like registrado com sucesso',
          likeId: newLike.id,
          postId: newLike.postId,
          profileId: newLike.profileId,
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

      const newComment = await this.prisma.comments.create({
        data: {
          postId,
          profileId: profile.id,
          content,
        },
      });

      return {
        message: 'Like registrado com sucesso',
        content: newComment.content,
        postId: newComment.postId,
        profileId: newComment.profileId,
        createdAt: newComment.createdAt,
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
}
