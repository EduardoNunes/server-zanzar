import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from 'src/prisma/prisma.service';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class ProfileService {
  private jwtToken = process.env.JWT_SECRET;
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private prisma: PrismaService) {}

  async getProfile(username: string, token: string) {
    try {
      let decodedToken: any;
      try {
        decodedToken = jwt.verify(token, this.jwtToken);
      } catch (error) {
        throw new BadRequestException('Token inválido ou expirado.');
      }
      const userProfile = await this.prisma.profiles.findUnique({
        where: { username },
      });

      if (!userProfile) {
        throw new BadRequestException('Perfil não encontrado.');
      }

      //se iguais está no próprio perfil, se n visitando perfil de alguém
      let isFollowed = false;
      if (decodedToken.sub !== userProfile.userId) {
        const selfProfile = await this.prisma.profiles.findUnique({
          where: { userId: decodedToken.sub },
        });
        if (!selfProfile) {
          throw new BadRequestException('Perfil do visitante não encontrado.');
        }
        const followRelation = await this.prisma.followers.findFirst({
          where: {
            followerId: selfProfile.id,
            followingId: userProfile.id,
          },
        });
        isFollowed = !!followRelation;
      }

      let avatarUrl = userProfile.avatarUrl;

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

        avatarUrl = data?.signedUrl;
      }

      return {
        username: userProfile.username,
        avatarUrl,
        role: userProfile.role,
        profileId: userProfile.userId,
        isFollowed: isFollowed,
        isOwnProfile: decodedToken.sub === userProfile.userId,
      };
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async getPosts(username: string) {
    try {
      const profile = await this.prisma.profiles.findUnique({
        select: { id: true },
        where: { username },
      });

      if (!profile) {
        throw new HttpException('Perfil não encontrado.', HttpStatus.NOT_FOUND);
      }

      const posts = await this.prisma.posts.findMany({
        where: { profileId: profile.id },
        select: {
          id: true,
          mediaUrl: true,
          caption: true,
          createdAt: true,
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
            if (!post.mediaUrl) {
              console.warn(`Post ${post.id} não possui mediaUrl. Ignorando...`);
              return {
                ...post,
                mediaUrl: null,
                likedByLoggedInUser: false,
                likeCount: post._count.likes,
                commentCount: post._count.comments,
              };
            }

            const bucketPath = post.mediaUrl.replace(
              'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/zanzar-images/',
              '',
            );

            const { data, error } = await this.supabase.storage
              .from('zanzar-images')
              .createSignedUrl(bucketPath, 3600);

            if (error || !data?.signedUrl) {
              console.error(
                `Erro ao gerar URL assinada para o post ${post.id}:`,
                error,
              );
              return {
                ...post,
                mediaUrl: null,
                likedByLoggedInUser: false,
                likeCount: post._count.likes,
                commentCount: post._count.comments,
              };
            }

            const likedByLoggedInUser = post.likes.some(
              (like) => like.profile.id === profile.id,
            );

            return {
              ...post,
              mediaUrl: data.signedUrl,
              likedByLoggedInUser,
              likeCount: post._count.likes,
              commentCount: post._count.comments,
            };
          } catch (error) {
            console.error(`Erro ao processar o post ${post.id}:`, error);
            return {
              ...post,
              mediaUrl: null,
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

  async updateProfileImage(userId: string, avatarFile: Express.Multer.File) {
    try {
      if (!avatarFile) {
        throw new BadRequestException('Nenhum arquivo de imagem enviado.');
      }

      const { data, error } = await this.supabase.storage
        .from('zanzar-images')
        .upload(`avatars/${userId}-avatar.png`, avatarFile.buffer, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        throw new BadRequestException(
          `Erro ao fazer upload da imagem: ${error.message}`,
        );
      }

      const avatarUrl = `https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/avatars/${userId}-avatar.png`;

      await this.prisma.profiles.update({
        where: { userId },
        data: { avatarUrl },
      });

      return { avatarUrl };
    } catch (error) {
      console.error('Erro ao atualizar imagem de perfil:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async followProfile(followerId: string, followingId: string) {
    try {
      const existingFollower = await this.prisma.profiles.findUnique({
        where: { userId: followerId },
        select: { id: true },
      });

      const existingFollowing = await this.prisma.profiles.findUnique({
        where: { userId: followingId },
        select: { id: true },
      });

      if (!existingFollower || !existingFollowing) {
        throw new Error('Algum perfil não foi encontrado.');
      }

      const existingFollow = await this.prisma.followers.findFirst({
        where: {
          followerId: existingFollower.id,
          followingId: existingFollowing.id,
        },
      });

      if (existingFollow) {
        await this.prisma.followers.delete({
          where: { id: existingFollow.id },
        });

        return { message: 'Você deixou de seguir este perfil.' };
      }

      const result = await this.prisma.followers.create({
        data: {
          followerId: existingFollower.id,
          followingId: existingFollowing.id,
        },
      });

      return { message: 'Perfil seguido com sucesso!', data: result };
    } catch (error) {
      console.error('Erro ao alternar o estado de seguir:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }
}
