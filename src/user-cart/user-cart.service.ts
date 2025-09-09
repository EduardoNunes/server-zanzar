import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class UserCartService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  private bucketName = process.env.BUCKET_MIDIAS;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('cancelation-orders') private readonly ordersQueue: Queue,
  ) { }

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

  async removeFromCart(profileId: string, itemId: string) {
    try {
      const productInCart = await this.prisma.userCart.findFirst({
        where: { id: itemId, profileId },
      });

      if (!productInCart) {
        throw new HttpException(
          'Produto não encontrado no carrinho.',
          HttpStatus.NOT_FOUND,
        );
      }

      const [deletedCartItem] = await this.prisma.$transaction([
        this.prisma.userCart.delete({
          where: { id: productInCart.id },
        }),

        this.prisma.profiles.update({
          where: { id: profileId },
          data: {
            cartCountItems: {
              decrement: 1,
            },
          },
        }),
      ]);

      return deletedCartItem;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erro ao remover item do carrinho.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateCartQuantity(
    profileId: string,
    itemId: string,
    newQuantity: number,
  ) {
    try {
      const productInCart = await this.prisma.userCart.findFirst({
        where: { id: itemId, profileId },
      });

      if (!productInCart) {
        throw new HttpException(
          'Produto não encontrado no carrinho.',
          HttpStatus.NOT_FOUND,
        );
      }

      if (newQuantity <= 0) {
        throw new HttpException(
          'A quantidade deve ser pelo menos 1.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const updatedCartItem = await this.prisma.userCart.update({
        where: { id: productInCart.id },
        data: { quantity: newQuantity },
      });

      return updatedCartItem;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erro ao atualizar a quantidade do item no carrinho.',
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
                `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
                '',
              );

              if (bucketPath.startsWith('/')) {
                bucketPath = bucketPath.slice(1);
              }

              const { data, error } = await this.supabase.storage
                .from(this.bucketName)
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

  async buyProducts(
    profileId: string,
    products: {
      productVariantSizeId: string;
      quantity: number;
      cartId: string;
    }[],
  ) {
    if (products.length > 5) {
      throw new HttpException(
        'Você só pode comprar até 5 produtos diferentes por vez.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let totalQuantity = 0;
    let totalPrice = 0;
    let totalPriceBase = 0;
    let order = null;
    const orderItemIds: string[] = []; // ✅ armazenar os itens criados

    try {
      await this.prisma.$transaction(async (tx) => {
        order = await tx.order.create({
          data: {
            profileId,
            paymentMethod: 'PIX',
            paymentStatus: 'PENDENTE',
            quantityItems: 0,
            totalPrice: 0,
            totalPriceBase: 0,
          },
        });

        for (const product of products) {
          const { productVariantSizeId, quantity, cartId } = product;

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
            throw new HttpException(
              `Produto não encontrado: ${productVariantSizeId}`,
              HttpStatus.NOT_FOUND,
            );
          }

          if (variantSize.stock < quantity) {
            throw new HttpException(
              `Estoque insuficiente para o produto ${variantSize.variant.product.name}, tamanho ${variantSize.size}.`,
              HttpStatus.BAD_REQUEST,
            );
          }

          if (quantity <= 0) {
            throw new HttpException(
              `Quantidade inválida para o produto ${variantSize.variant.product.name}, tamanho ${variantSize.size}.`,
              HttpStatus.BAD_REQUEST,
            );
          }

          // Calcula preços
          const priceAtPurchase = variantSize.price * quantity;
          const priceAtPurchaseBase = variantSize.basePrice * quantity;

          totalQuantity += quantity;
          totalPrice += priceAtPurchase;
          totalPriceBase += priceAtPurchaseBase;

          const orderItem = await tx.orderItem.create({
            data: {
              order: { connect: { id: order.id } },
              productVariantSize: { connect: { id: productVariantSizeId } },
              quantity,
              priceAtPurchase,
              priceAtPurchaseBase,
              userStore: {
                connect: { id: variantSize.variant.product.userStoreId },
              },
              status: 'PENDENTE',
            },
          });

          // ✅ guarda id do item para possível cancelamento
          orderItemIds.push(orderItem.id);

          // Atualiza estoque
          await tx.productVariantSize.update({
            where: { id: productVariantSizeId },
            data: {
              stock: {
                decrement: quantity,
              },
            },
          });

          const productUpdated = await tx.product.update({
            where: { id: variantSize.variant.productId },
            data: {
              totalSold: { increment: quantity },
              avaliableQuantity: { decrement: quantity },
            },
            select: {
              avaliableQuantity: true,
              userStoreId: true,
            },
          });

          // Atualiza dados da loja
          await tx.userStore.update({
            where: { id: productUpdated.userStoreId },
            data: {
              totalSales: { increment: quantity },
              totalRevenue: { increment: variantSize.price * quantity },
              totalFee: {
                increment:
                  variantSize.price * quantity -
                  variantSize.basePrice * quantity,
              },
            },
          });

          // Se zerou o estoque, decrementar totalProducts
          if (productUpdated.avaliableQuantity === 0) {
            await tx.userStore.update({
              where: { id: productUpdated.userStoreId },
              data: { totalProducts: { decrement: 1 } },
            });
          }

          // Atualiza carrinho
          await tx.profiles.update({
            where: { id: profileId },
            data: { cartCountItems: { decrement: 1 } },
          });

          await tx.userCart.delete({ where: { id: cartId } });
        }

        // Atualiza totais do pedido
        await tx.order.update({
          where: { id: order.id },
          data: {
            quantityItems: totalQuantity,
            totalPrice,
            totalPriceBase,
          },
        });
      });

      //  agenda cancelamento
      this.ordersQueue.add(
        'cancelation-orders',
        { profileId, orderId: order.id, orderItemIds },
        {
          delay: 5*60*1000, // 5 minutos
          removeOnComplete: true,
          removeOnFail: true,
        },
      );

      return { success: true, totalPrice, order };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Erro ao processar compra: ' + error.message,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async cancelPurchase(
    profileId: string,
    orderId: string,
    orderItemIds: string[],
  ) {
    try {
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, profileId },
        include: { items: true },
      });

      if (!order) {
        throw new HttpException('Pedido não encontrado.', HttpStatus.NOT_FOUND);
      }

      if (order.paymentStatus === 'CANCELADO') {
        throw new HttpException(
          'Este pedido já foi cancelado.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (order.paymentStatus !== 'PENDENTE') {
        throw new HttpException(
          'Apenas pedidos com status PENDENTE podem ser cancelados.',
          HttpStatus.BAD_REQUEST,
        );
      }

      const itemsToCancel = order.items.filter((item) =>
        orderItemIds.includes(item.id),
      );

      if (itemsToCancel.length === 0) {
        throw new HttpException(
          'Nenhum item válido para cancelar.',
          HttpStatus.BAD_REQUEST,
        );
      }

      await this.prisma.$transaction(async (tx) => {
        for (const item of itemsToCancel) {
          if (item.status === 'CANCELADO') {
            continue;
          }

          // Atualiza o status do item para CANCELADO
          await tx.orderItem.update({
            where: { id: item.id },
            data: { status: 'CANCELADO' },
          });

          // Restaura o estoque do produto
          const itemUpdated = await tx.productVariantSize.update({
            where: { id: item.productVariantSizeId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          });

          const productUpdated = await tx.product.update({
            where: { id: itemUpdated.variant.productId },
            data: {
              totalSold: {
                decrement: item.quantity,
              },
              avaliableQuantity: {
                increment: item.quantity,
              },
            },
          });
        }

        // Verifica se todos os itens do pedido foram cancelados
        const remainingItems = await tx.orderItem.findMany({
          where: { orderId: order.id, status: { not: 'CANCELADO' } },
        });

        if (remainingItems.length === 0) {
          // Se todos os itens foram cancelados, atualiza o status do pedido para CANCELADO
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: 'CANCELADO' },
          });
        }
      });

      return { success: true, message: 'Itens cancelados com sucesso.' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Erro ao cancelar itens do pedido.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
