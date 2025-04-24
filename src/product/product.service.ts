import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class ProductService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private prisma: PrismaService) { }

  async createProduct(data: {
    name: string;
    description: string;
    selectedCategory: string;
    selectedSubCategory: string;
    profileId: string;
    userStoreId: string;
    variants: {
      color: string;
      price: number;
      size: string;
      stock: number;
      images: Express.Multer.File[];
    }[];
  }) {
    const {
      name,
      description,
      selectedCategory,
      selectedSubCategory,
      userStoreId,
      variants,
    } = data;

    // Validação de categoria e subcategoria
    const category = await this.prisma.productCategory.findUnique({
      where: { id: selectedCategory },
    });

    if (!category) throw new Error(`Categoria '${selectedCategory}' não encontrada`);

    const subCategory = await this.prisma.productSubCategory.findUnique({
      where: { id: selectedSubCategory },
    });

    if (!subCategory) throw new Error(`Subcategoria '${selectedSubCategory}' não encontrada`);

    const userStore = await this.prisma.userStore.findUnique({
      where: { id: userStoreId },
    });

    if (!userStore) throw new Error(`Loja '${userStoreId}' não encontrada`);

    const preparedVariants = [];
    const uploadedFilePaths: string[] = [];

    try {
      // ⬇️ Upload de imagens antes da transação
      for (const variant of variants) {
        const uploadedImages = [];

        for (const image of variant.images) {
          const filename = `products/${Date.now()}-${image.originalname}`;
          const { data: uploadData, error } =
            await this.supabase.storage
              .from('zanzar-images')
              .upload(filename, image.buffer, {
                contentType: image.mimetype,
              });

          if (error) throw new Error(`Erro ao enviar imagem: ${error.message}`);

          const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/zanzar-images/${uploadData.path}`;
          uploadedImages.push(imageUrl);
          uploadedFilePaths.push(uploadData.path); // ← salva path para rollback
        }

        preparedVariants.push({ ...variant, uploadedImages });
      }

      // ⬇️ Transação para salvar produto e variantes
      return await this.prisma.$transaction(async (tx) => {
        const product = await tx.product.create({
          data: {
            name,
            description,
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
              color: variant.color,
              size: variant.size,
              price: variant.price,
              stock: variant.stock,
              basePrice: variant.price * (1 + (userStore.productFeePercentage || 0) / 100),
              sku: `${product.id}-${variant.color}-${variant.size}`.toLowerCase(),
            },
          });

          for (const imageUrl of variant.uploadedImages) {
            await tx.productImage.create({
              data: {
                variantId: createdVariant.id,
                url: imageUrl,
              },
            });
          }
        }

        return { message: 'Produto criado com sucesso' };
      });

    } catch (error) {
      // ⬇️ Rollback manual: remove imagens do Supabase se algo falhar
      await Promise.all(
        uploadedFilePaths.map(async (path) => {
          await this.supabase.storage.from('zanzar-images').remove([path]);
        })
      );

      throw error;
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
      const normalizedCategory = newCategory.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const existCategory = await this.prisma.productCategory.findFirst({
        where: {
          normalizedName: normalizedCategory,
        },
      });

      if (existCategory) {
        throw new HttpException(
          'Essa categoria já existe, você pode escolher ela em "Selecionar categoria"',
          HttpStatus.BAD_REQUEST
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
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }


  async loadSubCategories(categoryId: string) {
    try {
      const subCategories = await this.prisma.productSubCategory.findMany({
        where: {
          categoryId: categoryId
        }
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
      const normalizedSubCategory = newSubCategory.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

      const existSubCategory = await this.prisma.productSubCategory.findFirst({
        where: {
          normalizedName: normalizedSubCategory,
          categoryId: String(categoryId),
        },
      });

      if (existSubCategory) {
        throw new HttpException(
          'Essa subcategoria já existe, você pode escolher ela em "Selecionar subcategoria"',
          HttpStatus.BAD_REQUEST
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
        error.message || 'Erro ao criar subcategoria. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
