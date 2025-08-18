import { Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
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
      })),
    }));

    return formattedPurchases;
  }
}
