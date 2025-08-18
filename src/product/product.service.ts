import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { addProductSchema } from 'src/common/validations/addProductSchema';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValidationError } from 'yup';

@Injectable()
export class ProductService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
  private bucketName = process.env.BUCKET_MIDIAS;

  constructor(private prisma: PrismaService) {}

  async createProduct(product: {
    name: string;
    description: string;
    selectedCategory: string;
    selectedSubCategory: string;
    profileId: string;
    userStoreId: string;
    variants: {
      colorName: string;
      colorCode: string;
      sizes: {
        size: string;
        stock: number;
        basePrice: number;
        price: number;
        position: number;
      }[];
      images: Express.Multer.File[];
    }[];
    variantsImageMeta: { position: number }[][];
  }) {
    const {
      name,
      description,
      selectedCategory,
      selectedSubCategory,
      userStoreId,
      variants,
    } = product;

    try {
      addProductSchema.validateSync({
        name,
        description,
        selectedCategory,
        selectedSubCategory,
        variants,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        const errorMessages = error.inner.map((err) => err.message).join('; ');
        throw new HttpException(errorMessages, HttpStatus.BAD_REQUEST);
      } else {
        throw new HttpException(
          'Erro inesperado ao validar a variante.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }

    // Validação de categoria e subcategoria
    const category = await this.prisma.productCategory.findUnique({
      where: { id: selectedCategory },
    });

    if (!category)
      throw new Error(`Categoria '${selectedCategory}' não encontrada`);

    const subCategory = await this.prisma.productSubCategory.findUnique({
      where: { id: selectedSubCategory },
    });

    if (!subCategory)
      throw new Error(`Subcategoria '${selectedSubCategory}' não encontrada`);

    // Verifica se a loja existe
    const userStore = await this.prisma.userStore.findUnique({
      where: { id: userStoreId },
    });

    if (!userStore) throw new Error(`Loja '${userStoreId}' não encontrada`);

    const preparedVariants = [];
    const uploadedFilePaths: string[] = [];

    try {
      // Upload de imagens antes da transação
      for (let vIdx = 0; vIdx < variants.length; vIdx++) {
        const variant = variants[vIdx];
        const uploadedImages = [];
        for (const image of variant.images) {
          const { data: uploadData, error } = await this.supabase.storage
            .from(this.bucketName)
            .upload(
              `stores/${userStore.slug}-${userStore.profileId}/${userStoreId}-${Date.now()}`,
              image.buffer,
              {
                contentType: image.mimetype,
              },
            );

          if (error) throw new Error(`Erro ao enviar imagem: ${error.message}`);

          const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/${uploadData.path}`;
          uploadedImages.push(imageUrl);
          uploadedFilePaths.push(uploadData.path); // ← salva path para rollback
        }

        // Associa cada url ao respectivo objeto de imagem e inclui o metadado position
        const imagesWithUrls = (variant.images || []).map((img, idx) => ({
          ...img,
          url: uploadedImages[idx],
          position: product.variantsImageMeta?.[vIdx]?.[idx]?.position ?? idx,
        }));
        preparedVariants.push({ ...variant, images: imagesWithUrls });
      }

      // Transação para salvar produto e variantes
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name,
            description,
            rating: 0,
            ratingCount: 0,
            totalSold: 0,
            userStore: {
              connect: { id: userStoreId },
            },
            productSubCategory: {
              connect: { id: selectedSubCategory },
            },
          },
        });

        for (const variant of preparedVariants) {
          const createdVariant = await tx.productVariant.create({
            data: {
              productId: product.id,
              colorName: variant.colorName,
              colorCode: variant.colorCode,
            },
          });

          for (const size of variant.sizes) {
            const createVariantSize = await tx.productVariantSize.create({
              data: {
                variantId: createdVariant.id,
                size: size.size,
                stock: Number(size.stock),
                price: Number(size.price),
                basePrice: Number(size.basePrice),
              },
            });

            const sumQuantity = await tx.product.update({
              where: { id: product.id },
              data: {
                avaliableQuantity: {
                  increment: Number(size.stock),
                },
              },
            });
          }

          for (const image of variant.images) {
            await tx.productImage.create({
              data: {
                variantId: createdVariant.id,
                url: image.url,
                position: Number(image.position),
              },
            });
          }
        }

        // Incrementa 1 no totalProducts da tabela UserStore
        await tx.userStore.update({
          where: { id: userStoreId },
          data: {
            totalProducts: {
              increment: 1,
            },
          },
        });

        return { message: 'Produto criado com sucesso' };
      });
    } catch (error) {
      // Rollback manual: remove imagens do Supabase se algo falhar
      await Promise.all(
        uploadedFilePaths.map(async (path) => {
          await this.supabase.storage.from(this.bucketName).remove([path]);
        }),
      );

      throw error;
    }
  }

  async loadProducts(userStoreId: string, page: number) {
    try {
      const products = await this.prisma.product.findMany({
        where: {
          userStoreId,
        },
        include: {
          variations: {
            include: {
              images: true,
              sizes: true,
            },
          },
          productSubCategory: {
            include: {
              category: true,
            },
          },
        },
        skip: (page - 1) * 6,
        take: 6,
      });

      // Gerar URLs assinadas para imagens das variações
      for (const product of products) {
        for (const variant of product.variations) {
          if (variant.images && Array.isArray(variant.images)) {
            for (const image of variant.images) {
              if (image.url) {
                // Corrige o bucketPath para pegar apenas o path relativo ao bucket
                let bucketPath = image.url.replace(
                  `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
                  '',
                );
                // Remove barra inicial, se houver
                if (bucketPath.startsWith('/'))
                  bucketPath = bucketPath.slice(1);
                const { data, error } = await this.supabase.storage
                  .from(this.bucketName)
                  .createSignedUrl(bucketPath, 3600);
                if (!error && data?.signedUrl) {
                  image.url = data.signedUrl;
                }
              }
            }
          }
        }
      }

      return products;
    } catch (error) {
      console.error(`Erro ao carregar produtos:`, error);
      throw new HttpException(
        'Erro ao carregar produtos. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loadCategories() {
    try {
      const categories = await this.prisma.productCategory.findMany();

      return categories;
    } catch (error) {
      console.error(`Erro ao carregar categorias:`, error);
      throw new HttpException(
        'Erro ao carregar categorias. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createCategory(newCategory: string) {
    try {
      const normalizedCategory = newCategory
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const existCategory = await this.prisma.productCategory.findFirst({
        where: {
          normalizedName: normalizedCategory,
        },
      });

      if (existCategory) {
        throw new HttpException(
          'Essa categoria já existe, você pode escolher ela em "Selecionar categoria"',
          HttpStatus.BAD_REQUEST,
        );
      }

      const category = await this.prisma.productCategory.create({
        data: {
          name: newCategory,
          normalizedName: normalizedCategory,
        },
      });

      return category;
    } catch (error) {
      console.error(`Erro ao criar categoria:`, error);
      throw new HttpException(
        error.message || 'Erro ao criar categoria. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async loadSubCategories(categoryId: string) {
    try {
      const subCategories = await this.prisma.productSubCategory.findMany({
        where: {
          categoryId: categoryId,
        },
      });

      return subCategories;
    } catch (error) {
      console.error(`Erro ao carregar categorias:`, error);
      throw new HttpException(
        'Erro ao carregar sub-categorias. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createSubCategory(newSubCategory: string, categoryId: string) {
    try {
      // Normaliza o nome da subcategoria
      const normalizedSubCategory = newSubCategory
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const existSubCategory = await this.prisma.productSubCategory.findFirst({
        where: {
          normalizedName: normalizedSubCategory,
          categoryId: String(categoryId),
        },
      });

      if (existSubCategory) {
        throw new HttpException(
          'Essa subcategoria já existe, você pode escolher ela em "Selecionar subcategoria"',
          HttpStatus.BAD_REQUEST,
        );
      }

      const subCategory = await this.prisma.productSubCategory.create({
        data: {
          name: newSubCategory,
          categoryId: categoryId,
          normalizedName: normalizedSubCategory,
        },
      });

      return subCategory;
    } catch (error) {
      console.error(`Erro ao criar subcategoria:`, error);
      throw new HttpException(
        error.message ||
          'Erro ao criar subcategoria. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
