import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class UserCartService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private readonly prisma: PrismaService) {}

  async addToCart(
    profileId: string,
    productId: string,
    variationId: string,
    size: string,
    quantity: number,
  ) {
    try {
      const hasProduct = await this.prisma.userCart.findFirst({
        where: {
          profileId,
          productVariantSizeId: size,
        },
      });

      if (hasProduct) {
        throw new HttpException(
          'Este produto já está no carrinho.',
          HttpStatus.CONFLICT,
        );
      }

      const cartCountItems = await this.prisma.profiles.findFirst({
        where: { id: profileId },
        select: { cartCountItems: true },
      });

      if (cartCountItems.cartCountItems >= 10) {
        throw new HttpException(
          'O limite máximo de produtos no carrinho foi atingido.',
          HttpStatus.NOT_FOUND,
        );
      }

      const [userCart] = await this.prisma.$transaction([
        this.prisma.userCart.create({
          data: {
            profileId,
            productId,
            productVariantId: variationId,
            productVariantSizeId: size,
            quantity,
          },
        }),

        this.prisma.profiles.update({
          where: { id: profileId },
          data: {
            cartCountItems: {
              increment: 1,
            },
          },
        }),
      ]);

      return userCart;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erro ao adicionar item ao carrinho.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCartProducts(profileId: string) {
    try {
      const cartProducts = await this.prisma.userCart.findMany({
        where: { profileId },
        select: {
          id: true,
          quantity: true,
          productVariantSize: {
            select: {
              id: true,
              size: true,
              price: true,
              stock: true,
            },
          },
          productVariant: {
            select: {
              colorCode: true,
              colorName: true,
              images: {
                select: {
                  url: true,
                },
              },
              product: {
                select: {
                  name: true,
                  description: true,
                },
              },
            },
          },
        },
      });

      const processedCartProducts = await Promise.all(
        cartProducts.map(async (item) => {
          // Gera URLs assinadas para todas as imagens
          const signedImageUrls = await Promise.all(
            item.productVariant.images.map(async (image) => {
              let bucketPath = image.url.replace(
                `${process.env.SUPABASE_URL}/storage/v1/object/public/zanzar-images/`,
                '',
              );

              if (bucketPath.startsWith('/')) {
                bucketPath = bucketPath.slice(1);
              }

              const { data, error } = await this.supabase.storage
                .from('zanzar-images')
                .createSignedUrl(bucketPath, 3600);

              if (error || !data?.signedUrl) {
                throw new Error(
                  'Erro ao gerar URL assinada: ' + error?.message,
                );
              }

              return data.signedUrl;
            }),
          );

          return {
            id: item.id,
            productVariantSizeId: item.productVariantSize.id,
            quantity: item.quantity,
            size: item.productVariantSize.size,
            price: item.productVariantSize.price,
            stock: item.productVariantSize.stock,
            colorCode: item.productVariant.colorCode,
            colorName: item.productVariant.colorName,
            images: signedImageUrls,
            name: item.productVariant.product.name,
            description: item.productVariant.product.description,
          };
        }),
      );

      return processedCartProducts;
    } catch (error) {
      throw new Error('Error fetching cart products: ' + error.message);
    }
  }

  async buyProducts(profileId: string, products: any[]) {
    if (products.length > 5) {
      throw new HttpException(
        'Você só pode comprar até 5 produtos diferentes por vez.',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.create({
          data: {
            profileId,
          },
        });

        for (const product of products) {
          const { productVariantSizeId, quantity, cartId } = product as {
            productVariantSizeId: string;
            quantity: number;
            cartId: string;
          };

          const variantSize = await tx.productVariantSize.findFirst({
            where: { id: productVariantSizeId },
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          });

          if (!variantSize) {
            throw new Error(
              `ProductVariantSize not found: ${productVariantSizeId}`,
            );
          }

          await tx.orderItem.create({
            data: {
              order: { connect: { id: order.id } },
              productVariantSize: { connect: { id: productVariantSizeId } },
              quantity,
              priceAtPurchase: variantSize.price * quantity,
              userStore: {
                connect: { id: variantSize.variant.product.userStoreId },
              },
              status: 'PAGO',
            },
          });

          await tx.productVariantSize.update({
            where: { id: productVariantSizeId },
            data: {
              stock: {
                decrement: quantity,
              },
            },
          });

          await tx.profiles.update({
            where: { id: profileId },
            data: {
              cartCountItems: {
                decrement: 1,
              },
            },
          });

          await tx.userCart.delete({
            where: { id: cartId },
          });
        }
      });

      return { success: true };
    } catch (error) {
      throw new Error('Error buying products: ' + error.message);
    }
  }
}
