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
      let userProfile: any;
      try {
        decodedToken = jwt.verify(token, this.jwtToken);

        userProfile = await this.prisma.profiles.findUnique({
          where: { userId: decodedToken.sub },
        });
      } catch (error) {
        throw new BadRequestException('Token inválido ou expirado.');
      }

      const currentUserProfile = await this.prisma.profiles.findUnique({
        where: { username },
      });

      if (!currentUserProfile) {
        throw new BadRequestException('Perfil não encontrado.');
      }

      //se iguais está no próprio perfil, se n visitando perfil de alguém
      let isFollowed = false;

      if (userProfile.id !== currentUserProfile.id) {
        const followRelation = await this.prisma.followers.findFirst({
          where: {
            followerId: userProfile.id,
            followingId: currentUserProfile.id,
          },
        });
        isFollowed = !!followRelation;
      }

      let avatarUrl = currentUserProfile.avatarUrl;

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
        username: currentUserProfile.username,
        avatarUrl,
        role: currentUserProfile.role,
        profileId: currentUserProfile.id,
        isFollowed: isFollowed,
        isOwnProfile: userProfile.id === currentUserProfile.id,
        followersCount: currentUserProfile.followersCount,
        followingCount: currentUserProfile.followingCount,
        totalPosts: currentUserProfile.totalPosts,
      };
    } catch (error) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async getPosts(
    username: string,
    page: number = 1,
    limit: number = 3,
    loggedInProfileId?: string,
  ) {
    try {
      const profile = await this.prisma.profiles.findUnique({
        where: { username },
      });

      if (!profile) {
        throw new HttpException('Perfil não encontrado.', HttpStatus.NOT_FOUND);
      }

      const skipCategories = (page - 1) * limit;

      // Get unique categories for the profile
      const uniqueCategories = await this.prisma.posts.findMany({
        where: { profileId: profile.id },
        distinct: ['categoryId'],
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          category: {
            select: {
              categories: true,
            },
          },
        },
        skip: skipCategories,
        take: limit,
      });

      //Fetch the first 3 posts of each category.
      const postsByCategory = await Promise.all(
        uniqueCategories.map(async (cat) => {
          const category = cat.category.categories;

          const posts = await this.prisma.posts.findMany({
            where: {
              profileId: profile.id,
              category: { categories: category },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 3,
            select: {
              id: true,
              mediaUrl: true,
              caption: true,
              createdAt: true,
              category: {
                select: {
                  id: true,
                  categories: true,
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
          return posts;
        }),
      );

      //Flatten the array of arrays
      const allPosts = postsByCategory.flat();

      const postsWithSignedUrls = await Promise.all(
        allPosts.map(async (post) => {
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

            // Check if the logged-in profile has liked the post
            const likedByLoggedInUser = loggedInProfileId
              ? post.likes.some((like) => like.profile.id === loggedInProfileId)
              : false;

            return {
              ...post,
              mediaUrl: data.signedUrl,
              likedByLoggedInUser,
              likeCount: post._count.likes,
              commentCount: post._count.comments,
              category: post.category,
            };
          } catch (error) {
            console.error(`Erro ao processar o post ${post.id}:`, error);
            return {
              ...post,
              mediaUrl: null,
              likedByLoggedInUser: false,
              likeCount: post._count.likes,
              commentCount: post._count.comments,
              category: post.category,
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

  async getPostsByCategory(
    categoryId: string,
    profileId: string,
    page: number = 2,
    limit: number = 3,
  ) {
    try {
      const skip = (page - 1) * limit;

      const posts = await this.prisma.posts.findMany({
        where: {
          categoryId,
          profileId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
        select: {
          id: true,
          mediaUrl: true,
          caption: true,
          createdAt: true,
          category: {
            select: {
              categories: true,
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
            if (!post.mediaUrl) {
              console.warn(`Post ${post.id} não possui mediaUrl. Ignorando...`);
              return {
                ...post,
                mediaUrl: null,
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
                likeCount: post._count.likes,
                commentCount: post._count.comments,
              };
            }

            return {
              ...post,
              mediaUrl: data.signedUrl,
              likeCount: post._count.likes,
              commentCount: post._count.comments,
              category: post.category,
            };
          } catch (error) {
            console.error(`Erro ao processar o post ${post.id}:`, error);
            return {
              ...post,
              mediaUrl: null,
              likeCount: post._count.likes,
              commentCount: post._count.comments,
              category: post.category,
            };
          }
        }),
      );

      return postsWithSignedUrls;
    } catch (error) {
      console.error('Erro ao buscar posts paginados:', error);
      throw new HttpException(
        'Erro ao buscar os posts. Tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateProfileImage(profileId: string, avatarFile: Express.Multer.File) {
    try {
      if (!avatarFile) {
        throw new BadRequestException('Nenhum arquivo de imagem enviado.');
      }

      const { data, error } = await this.supabase.storage
        .from('zanzar-images')
        .upload(`avatars/${profileId}-avatar.png`, avatarFile.buffer, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        throw new BadRequestException(
          `Erro ao fazer upload da imagem: ${error.message}`,
        );
      }

      const avatarUrl = `https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/avatars/${profileId}-avatar.png`;

      await this.prisma.profiles.update({
        where: { id: profileId },
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
      // Busca os perfis do seguidor e do perfil a ser seguido
      const existingFollower = await this.prisma.profiles.findUnique({
        where: { id: followerId },
        select: { id: true },
      });

      const existingFollowing = await this.prisma.profiles.findUnique({
        where: { id: followingId },
        select: { id: true },
      });

      if (!existingFollower || !existingFollowing) {
        throw new Error('Algum perfil não foi encontrado.');
      }

      // Verifica se a relação de seguimento já existe
      const existingFollow = await this.prisma.followers.findFirst({
        where: {
          followerId: existingFollower.id,
          followingId: existingFollowing.id,
        },
      });

      if (existingFollow) {
        // Se a relação já existe, remove-a (deixar de seguir)
        await this.prisma.$transaction(async (tx) => {
          await tx.followers.delete({
            where: { id: existingFollow.id },
          });

          // Decrementa as contagens
          await tx.profiles.update({
            where: { id: existingFollower.id },
            data: { followingCount: { decrement: 1 } },
          });

          await tx.profiles.update({
            where: { id: existingFollowing.id },
            data: { followersCount: { decrement: 1 } },
          });
        });

        return { message: 'Você deixou de seguir este perfil.' };
      } else {
        // Se a relação não existe, cria-a (seguir)
        await this.prisma.$transaction(async (tx) => {
          await tx.followers.create({
            data: {
              followerId: existingFollower.id,
              followingId: existingFollowing.id,
            },
          });

          // Incrementa as contagens
          await tx.profiles.update({
            where: { id: existingFollower.id },
            data: { followingCount: { increment: 1 } },
          });

          await tx.profiles.update({
            where: { id: existingFollowing.id },
            data: { followersCount: { increment: 1 } },
          });
        });

        return { message: 'Perfil seguido com sucesso!' };
      }
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
