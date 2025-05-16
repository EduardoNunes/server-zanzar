import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoreDataProps } from 'src/types/story-types';

@Injectable()
export class StoreService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );
  private bucketName = process.env.BUCKET_MIDIAS;

  constructor(private readonly prisma: PrismaService) {}

  async createStore(
    storeData: StoreDataProps,
    profileId: string,
    logo: Express.Multer.File,
    banner: Express.Multer.File,
  ) {
    const { name, description, address } = storeData;

    try {
      if (!name || !description) {
        throw new HttpException(
          'Nome e descrição da loja são obrigatórios.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException(
          'Usuário não encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      const existingStore = await this.prisma.userStore.findFirst({
        where: {
          OR: [
            {
              name: {
                equals: name,
                mode: 'insensitive',
              },
            },
            {
              slug: {
                equals: name.toLowerCase().replace(/\s+/g, '-'),
                mode: 'insensitive',
              },
            },
          ],
        },
      });

      if (existingStore) {
        throw new HttpException(
          'Já existe uma loja com esse nome.',
          HttpStatus.CONFLICT,
        );
      }

      const sanitizeFileName = (name: string) =>
        name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9.\-_]/g, '')
          .toLowerCase();

      const logoCleanOriginalName = sanitizeFileName(logo.originalname);

      // Upload do LOGO na pasta logoPath = slug-profileId/data-nomeDaLogo
      const logoPath = `stores/${name.toLowerCase().replace(/\s+/g, '-')}-${profileId}/${Date.now()}-${logoCleanOriginalName}`;
      const { data: logoUploadData, error: logoUploadError } =
        await this.supabase.storage
          .from(this.bucketName)
          .upload(logoPath, logo.buffer, {
            contentType: logo.mimetype,
          });

      if (logoUploadError) {
        throw new HttpException(
          `Erro ao fazer upload do logo: ${logoUploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const { data: logoUrlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(logoUploadData.path);
      const logoUrl = logoUrlData?.publicUrl;

      const bannerCleanOriginalName = sanitizeFileName(logo.originalname);

      // Upload do BANNER
      const bannerPath = `stores/${name.toLowerCase().replace(/\s+/g, '-')}-${profileId}/${Date.now()}-${bannerCleanOriginalName}`;
      const { data: bannerUploadData, error: bannerUploadError } =
        await this.supabase.storage
          .from(this.bucketName)
          .upload(bannerPath, banner.buffer, {
            contentType: banner.mimetype,
          });

      if (bannerUploadError) {
        throw new HttpException(
          `Erro ao fazer upload do banner: ${bannerUploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const { data: bannerUrlData } = this.supabase.storage
        .from(this.bucketName)
        .getPublicUrl(bannerUploadData.path);
      const bannerUrl = bannerUrlData?.publicUrl;

      if (!logoUrl || !bannerUrl) {
        throw new HttpException(
          'Erro ao obter URLs públicas das imagens.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const [createdAddress, createdStore, updatedProfile] =
        await this.prisma.$transaction(async (tx) => {
          let createdAddress = null;

          if (address) {
            const parsedAddress =
              typeof address === 'string' ? JSON.parse(address) : address;

            const {
              street,
              number,
              complement,
              neighborhood,
              city,
              state,
              country,
              postalCode,
            } = parsedAddress;

            createdAddress = await tx.address.create({
              data: {
                street,
                number,
                complement: complement || null,
                district: neighborhood,
                city,
                state,
                country,
                zipCode: postalCode,
              },
            });
          }

          const storeData: any = {
            name,
            slug: name.toLowerCase().replace(/\s+/g, '-'),
            description,
            logoUrl,
            bannerUrl,
            rating: 0,
            ratingCount: 0,
            totalRevenue: 0,
            isActive: false,
            productFeePercentage: 5,
            subscriptionAmount: 3000,
            profile: {
              connect: { id: profileId },
            },
          };

          if (createdAddress) {
            storeData.address = {
              connect: { id: createdAddress.id },
            };
          }

          const createdStore = await tx.userStore.create({ data: storeData });

          const updatedProfile = await tx.profiles.update({
            where: { id: profileId },
            data: { hasUserStore: true },
          });

          return [createdAddress, createdStore, updatedProfile];
        });

      return { createdAddress, createdStore, updatedProfile };
    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Erro ao criar loja.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUserStore(slug: string, profileId: string) {
    const store = await this.prisma.userStore.findFirst({
      where: { slug },
      include: {
        address: true,
      },
    });

    if (!store) {
      throw new HttpException('Loja não encontrada.', HttpStatus.NOT_FOUND);
    }

    //se iguais está no próprio perfil, se n, visitando perfil de alguém
    let isFavorited = false;

    if (profileId !== store.profileId) {
      const favoriteRelation = await this.prisma.favoriteStore.findFirst({
        where: {
          profileId: profileId,
          storeId: store.id,
        },
      });
      isFavorited = !!favoriteRelation;
    }

    // Generate signed URLs for logo and banner if present
    let logoUrl = store.logoUrl;
    let bannerUrl = store.bannerUrl;

    if (logoUrl) {
      const bucketPath = logoUrl.split(`/${this.bucketName}/`)[1];
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(bucketPath, 3600);
      if (!error && data?.signedUrl) {
        logoUrl = data.signedUrl;
      }
    }

    if (bannerUrl) {
      const bucketPath = bannerUrl.split(`/${this.bucketName}/`)[1];
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(bucketPath, 3600);
      if (!error && data?.signedUrl) {
        bannerUrl = data.signedUrl;
      }
    }

    return {
      ...store,
      logoUrl,
      bannerUrl,
      isFavorited,
    };
  }

  async updateBanner(
    profileId: string,
    bannerFile: Express.Multer.File,
    userStoreId: string,
  ) {
    try {
      if (!bannerFile) {
        throw new BadRequestException('Nenhum arquivo de imagem enviado.');
      }

      const isOwner = await this.prisma.userStore.findFirst({
        where: {
          id: userStoreId,
          profileId: profileId,
        },
      });

      if (!isOwner) {
        throw new BadRequestException('Como você conseguiu chegar até aqui?');
      }

      // Faz o upload (com upsert: true)
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(
          `stores/${isOwner.slug}-${profileId}/${userStoreId}-banner.png`,
          bannerFile.buffer,
          {
            cacheControl: '3600',
            upsert: true,
          },
        );

      if (uploadError) {
        throw new BadRequestException(
          `Erro ao fazer upload da imagem: ${uploadError.message}`,
        );
      }

      // Gera a URL assinada válida por 1 hora
      const { data: signedUrlData, error: signedUrlError } =
        await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(
            `stores/${isOwner.slug}-${profileId}/${userStoreId}-banner.png`,
            60 * 60,
          ); // 1 hora

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new BadRequestException('Erro ao gerar URL assinada.');
      }

      const bannerUrl = signedUrlData.signedUrl;

      // Atualiza a store com a URL do banner
      await this.prisma.userStore.update({
        where: { id: userStoreId },
        data: { bannerUrl },
      });

      return bannerUrl;
    } catch (error) {
      console.error('Erro ao atualizar imagem de banner:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async updateLogo(
    profileId: string,
    logoFile: Express.Multer.File,
    userStoreId: string,
  ) {
    try {
      if (!logoFile) {
        throw new BadRequestException('Nenhum arquivo de imagem enviado.');
      }

      const isOwner = await this.prisma.userStore.findFirst({
        where: {
          id: userStoreId,
          profileId: profileId,
        },
      });

      if (!isOwner) {
        throw new BadRequestException('Como você conseguiu chegar até aqui?');
      }

      // Upload da imagem para o Supabase Storage com overwrite (upsert)
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(
          `stores/${isOwner.slug}-${profileId}/${userStoreId}-logo.png`,
          logoFile.buffer,
          {
            cacheControl: '3600',
            upsert: true,
          },
        );

      if (uploadError) {
        throw new BadRequestException(
          `Erro ao fazer upload da imagem: ${uploadError.message}`,
        );
      }

      // Geração de URL assinada (válida por 1 hora)
      const { data: signedUrlData, error: signedUrlError } =
        await this.supabase.storage
          .from(this.bucketName)
          .createSignedUrl(
            `stores/${isOwner.slug}-${profileId}/${userStoreId}-logo.png`,
            60 * 60,
          ); // 1 hora

      if (signedUrlError || !signedUrlData?.signedUrl) {
        throw new BadRequestException('Erro ao gerar URL assinada.');
      }

      const logoUrl = signedUrlData.signedUrl;

      // Atualiza a store com a nova logo
      await this.prisma.userStore.update({
        where: { id: userStoreId },
        data: { logoUrl },
      });

      return { logoUrl };
    } catch (error) {
      console.error('Erro ao atualizar imagem de logo:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async toFavoriteStore(profileId: string, storeId: string) {
    try {
      const favoriteRelation = await this.prisma.favoriteStore.findFirst({
        where: {
          profileId,
          storeId,
        },
      });

      if (favoriteRelation) {
        await this.prisma.favoriteStore.delete({
          where: {
            id: favoriteRelation.id,
          },
        });

        await this.prisma.userStore.update({
          where: { id: storeId },
          data: {
            totalFavoriters: {
              decrement: 1,
            },
          },
        });
      } else {
        await this.prisma.favoriteStore.create({
          data: {
            profileId,
            storeId,
          },
        });

        await this.prisma.userStore.update({
          where: { id: storeId },
          data: {
            totalFavoriters: {
              increment: 1,
            },
          },
        });
      }
    } catch (error) {
      console.error('Erro ao favoritar loja:', error);
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }

  async getStoreIdBySlug(slug: string) {
    const store = await this.prisma.userStore.findFirst({
      where: { slug },
    });

    if (!store) {
      throw new HttpException('Loja não encontrada.', HttpStatus.NOT_FOUND);
    }

    return store.profileId;
  }

  async getStoreOrders(
    profileId: string,
    slug: string,
    page: number,
    limit: number,
  ) {
    const store = await this.prisma.userStore.findFirst({
      where: { slug },
    });

    if (!store) {
      throw new HttpException('Loja não encontrada.', HttpStatus.NOT_FOUND);
    }

    if (store.profileId !== profileId) {
      throw new HttpException(
        'Acesso não autorizado.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const skip = (page - 1) * limit;

    const ordersItems = await this.prisma.orderItem.findMany({
      where: { storeId: store.id },
      include: {
        order: {
          include: {
            profile: {
              select: {
                id: true,
                username: true,
                user: {
                  select: {
                    id: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        productVariantSize: {
          include: {
            variant: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    description: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        order: {
          createdAt: 'desc',
        },
      },
      skip,
      take: Number(limit),
    });

    const formattedOrders = ordersItems.map((item) => {
      const {
        order,
        productVariantSize,
        quantity,
        priceAtPurchase,
        status,
        priceAtPurchaseBase,
      } = item;
      const { profile } = order;
      const { variant } = productVariantSize;
      const { product } = variant;

      return {
        orderId: order.id,
        orderItem: item.id,
        status,
        customer: {
          id: profile.id,
          username: profile.username,
          email: profile.user.email,
        },
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
        },
        variant: {
          id: productVariantSize.id,
          size: productVariantSize.size,
          basePrice: productVariantSize.basePrice,
          colorName: variant.colorName,
        },
        quantity,
        priceAtPurchase,
        priceAtPurchaseBase,
      };
    });

    return formattedOrders;
  }

  async updateOrderStatus(orderItemId: string, status: string) {
    const orderItem = await this.prisma.orderItem.findUnique({
      where: { id: orderItemId },
    });

    if (!orderItem) {
      throw new HttpException('Pedido não encontrado.', HttpStatus.NOT_FOUND);
    }

    if (orderItem.status === 'CANCELED') {
      throw new HttpException(
        'Não é possível alterar o status de um pedido cancelado.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const updatedOrder = await this.prisma.orderItem.update({
      where: { id: orderItemId },
      data: { status },
    });

    return updatedOrder;
  }
}
