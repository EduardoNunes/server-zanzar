import { Injectable } from '@nestjs/common';
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
      const userCart = await this.prisma.userCart.create({
        data: {
          profileId,
          productId,
          productVariantId: variationId,
          productVariantSizeId: size,
          quantity,
        },
      });
      return userCart;
    } catch (error) {
      throw new Error('Error adding item to cart: ' + error.message);
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
}
