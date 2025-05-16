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
  private bucketName = process.env.BUCKET_MIDIAS;

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
        include: {
          userStore: {
            select: {
              slug: true,
            },
          },
        },
      });

      if (!currentUserProfile) {
        throw new BadRequestException('Perfil não encontrado.');
      }

      //se iguais está no próprio perfil, se n, visitando perfil de alguém
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
          `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
          '',
        );

        const { data, error } = await this.supabase.storage
          .from(this.bucketName)
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
        hasUserStore: currentUserProfile.hasUserStore,
        storeSlug: currentUserProfile.userStore?.slug,
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
    limit: number = 4,
    profileIdVisitant: string,
  ) {
    try {
      const profileVisited = await this.prisma.profiles.findUnique({
        where: { username },
      });

      if (!profileVisited) {
        throw new HttpException('Perfil não encontrado.', HttpStatus.NOT_FOUND);
      }

      const skipCategories = (page - 1) * limit;

      // Pegar as categorias únicas dos posts do perfil
      const uniqueCategories = await this.prisma.posts.findMany({
        where: { profileId: profileVisited.id },
        distinct: ['categoryId'],
        orderBy: { createdAt: 'desc' },
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

      // Buscar os posts de cada categoria
      const postsByCategory = await Promise.all(
        uniqueCategories.map(async (cat) => {
          const category = cat.category.categories;

          const posts = await this.prisma.posts.findMany({
            where: {
              profileId: profileVisited.id,
              category: { categories: category },
            },
            orderBy: {
              createdAt: 'desc',
            },
            take: 4,
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

      const allPosts = postsByCategory.flat();

      // Buscar os postIds curtidos pelo visitante
      const likedPostIds = profileIdVisitant
        ? await this.prisma.likes
            .findMany({
              where: {
                profileId: profileIdVisitant,
                postId: { in: allPosts.map((post) => post.id) },
              },
              select: { postId: true },
            })
            .then((res) => res.map((r) => r.postId))
        : [];

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
              `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
              '',
            );

            const { data, error } = await this.supabase.storage
              .from(this.bucketName)
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

            const likedByLoggedInUser = likedPostIds.includes(post.id);

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
    limit: number = 4,
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
              `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
              '',
            );

            const { data, error } = await this.supabase.storage
              .from(this.bucketName)
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

      const filePath = `users/${profileId}/${profileId}-${Date.now()}-avatar.png`;

      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, avatarFile.buffer, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        throw new BadRequestException(
          `Erro ao fazer upload da imagem: ${error.message}`,
        );
      }

      const avatarUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/${filePath}`;

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

  async getUserData(profileId: string) {
    try {
      const userData = await this.prisma.profiles.findUnique({
        where: { id: profileId },
        select: {
          fullName: true,
          birthDate: true,
          phoneNumber: true,
          cpf: true,
          addressId: true,
          address: {
            select: {
              street: true,
              number: true,
              complement: true,
              district: true,
              city: true,
              state: true,
              zipCode: true,
              country: true,
            },
          },
        },
      });

      const formattedAddress = userData.address
        ? {
            street: userData.address.street,
            number: userData.address.number,
            complement: userData.address.complement,
            neighborhood: userData.address.district,
            city: userData.address.city,
            state: userData.address.state,
            postalCode: userData.address.zipCode,
            country: userData.address.country,
          }
        : null;

      const formattedBirthDate = userData.birthDate
        ? new Date(userData.birthDate).toISOString().split('T')[0]
        : null;

      return {
        fullName: userData.fullName,
        birthDate: formattedBirthDate,
        phoneNumber: userData.phoneNumber,
        cpf: userData.cpf,
        addressId: userData.addressId,
        address: formattedAddress,
      };
    } catch (error) {
      console.error('Erro ao buscar dados do usuário:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async updateUserData(
    profileId: string,
    fullName: string,
    birthDate: string,
    phoneNumber: string,
    cpf: string,
    addressId: string,
    street: string,
    number: string,
    complement: string,
    neighborhood: string,
    city: string,
    state: string,
    postalCode: string,
    country: string,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        let address;

        if (!addressId) {
          address = await tx.address.create({
            data: {
              street,
              number,
              complement,
              district: neighborhood,
              city,
              state,
              country,
              zipCode: postalCode,
            },
          });
        } else {
          address = await tx.address.update({
            where: { id: addressId },
            data: {
              street,
              number,
              complement,
              district: neighborhood,
              city,
              state,
              country,
              zipCode: postalCode,
            },
          });
        }

        await tx.profiles.update({
          where: { id: profileId },
          data: {
            fullName,
            birthDate: new Date(birthDate),
            phoneNumber,
            cpf,
            addressId: address.id,
          },
        });
      });

      return { message: 'Dados atualizados com sucesso!' };
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }
}
