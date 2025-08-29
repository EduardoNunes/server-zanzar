import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { race } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PurchasesService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  private bucketName = process.env.BUCKET_MIDIAS;

  constructor(private prisma: PrismaService) {}

  async getUserPurchases(profileId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const purchases = await this.prisma.order.findMany({
      where: { profileId },
      skip: offset,
      take: limit,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        items: {
          include: {
            productVariantSize: {
              include: {
                variant: {
                  include: {
                    product: true,
                    images: true,
                  },
                },
              },
            },
            userStore: true,
            productReviews: true, // Include productReview data
          },
        },
      },
    });

    // Gera URLs assinadas paralelamente
    await Promise.all(
      purchases.map(async (purchase) => {
        await Promise.all(
          purchase.items.map(async (item) => {
            const images = item.productVariantSize.variant.images;

            if (images?.length) {
              await Promise.all(
                images.map(async (image) => {
                  if (image.url) {
                    let bucketPath = image.url.replace(
                      `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
                      '',
                    );
                    if (bucketPath.startsWith('/'))
                      bucketPath = bucketPath.slice(1);

                    const { data, error } = await this.supabase.storage
                      .from(this.bucketName)
                      .createSignedUrl(bucketPath, 3600);

                    if (!error && data?.signedUrl) {
                      image.url = data.signedUrl;
                    }
                  }
                }),
              );
            }
          }),
        );
      }),
    );

    // Formata os dados retornados
    const formattedPurchases = purchases.map((purchase) => ({
      orderId: purchase.id,
      orderDate: purchase.createdAt,
      total: purchase.items.reduce(
        (sum, item) => sum + item.priceAtPurchase * item.quantity,
        0,
      ),
      items: purchase.items.map((item) => ({
        orderItemId: item.id,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
        storeName: item.userStore.name,
        storeSlug: item.userStore.slug,
        status: item.status,
        productName: item.productVariantSize.variant.product.name,
        variantColorName: item.productVariantSize.variant.colorName,
        variantSize: item.productVariantSize.size,
        variantSizePrice: item.productVariantSize.price,
        images: item.productVariantSize.variant.images.map((image) => ({
          url: image.url,
          position: image.position,
        })),
        productReview: item.productReviews
          ? item.productReviews
          : 'not-evaluated', // Add productReview data or "not-evaluated"
      })),
    }));

    return formattedPurchases;
  }

  async createEvaluateProduct(
    profileId: string,
    evaluationData: {
      orderItemId: string;
      productRating: number;
      productComment: string;
    },
  ) {
    const { orderItemId, productRating, productComment } = evaluationData;

    try {
      // 🔎 Verifica se a compra pertence ao usuário
      const orderItem = await this.prisma.orderItem.findFirst({
        where: {
          id: orderItemId,
          order: { profileId },
        },
        include: {
          productVariantSize: {
            include: {
              variant: true,
            },
          },
        },
      });

      if (!orderItem) {
        throw new HttpException('Compra não encontrada.', HttpStatus.NOT_FOUND);
      }

      // 🔎 Verifica se já existe avaliação do produto
      const existingProductEvaluation =
        await this.prisma.productReview.findFirst({
          where: { orderItemId, profileId },
        });

      if (existingProductEvaluation) {
        throw new HttpException(
          'Este produto já foi avaliado.',
          HttpStatus.CONFLICT,
        );
      }

      // 🔒 Usa transaction para criar avaliação + atualizar produto
      const [productReview] = await this.prisma.$transaction([
        this.prisma.productReview.create({
          data: {
            profileId,
            rating: productRating,
            comment: productComment,
            orderItemId,
          },
        }),

        this.prisma.product.update({
          where: { id: orderItem.productVariantSize.variant.productId },
          data: {
            rating: { increment: productRating },
            ratingCount: {
              increment: 1,
            },
          },
        }),
      ]);

      return {
        success: true,
        message: 'Produto avaliado com sucesso!',
        data: { productReview },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erro inesperado ao registrar avaliação.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
