import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';
import { ProductService } from './product.service';

@Controller('product')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) { }

  @Post('add-product')
  @UseInterceptors(AnyFilesInterceptor())
  async addProduct(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const rawBody = req.body;

    // Remove prototype null para garantir compatibilidade
    const body = JSON.parse(JSON.stringify(rawBody));
    const { name, description, selectedCategory, selectedSubCategory, profileId, userStoreId } = body;

    if (!name) {
      throw new Error('Informe um nome para o produto');
    }

    if (!description) {
      throw new Error('Informe uma descrição para o produto');
    }

    if (!selectedCategory) {
      throw new Error('Selecione uma categoria');
    }

    if (!selectedSubCategory) {
      throw new Error('Selecione uma subcategoria');
    }

    if (!userStoreId) {
      throw new Error('Tem algo errado com a identificação da loja, entre em contato com um adm.');
    }

    if (!body.variants || body.variants.length === 0) {
      throw new Error('Pelo menos uma variante deve ser informada');
    }

    // Trata variants que podem chegar como array ou string
    let variantsRaw: any[] = [];

    if (Array.isArray(body.variants)) {
      variantsRaw = body.variants;
    } else if (typeof body.variants === 'string') {
      try {
        variantsRaw = JSON.parse(body.variants);
      } catch (err) {
        console.error('Erro ao parsear "variants":', err);
        return { message: 'Formato inválido para variants' };
      }
    }

    // Agrupa arquivos por fieldname
    const imagesByField: { [key: string]: Express.Multer.File[] } = {};
    if (Array.isArray(files)) {
      for (const file of files) {
        if (!imagesByField[file.fieldname]) {
          imagesByField[file.fieldname] = [];
        }
        imagesByField[file.fieldname].push(file);
      }
    }

    // Monta array final de variants com as imagens associadas
    const variants: any[] = Array.isArray(variantsRaw)
      ? variantsRaw.map((variant, index) => ({
        color: variant.color,
        price: parseFloat(variant.price),
        size: variant.size,
        stock: parseInt(variant.stock, 10),
        images: imagesByField[`variants[${index}][images][]`] || [],
      }))
      : [];

    return this.productService.createProduct({
      name,
      description,
      selectedCategory,
      selectedSubCategory,
      profileId,
      userStoreId,
      variants,
    });
  }

  @Get('load-products')
  async loadProducts(
    @Query('storeSlug') userStoreId: string,
    @Query('page') page: number,
    @Query('profileId') profileId: string,
  ) {
    return this.productService.loadProducts(userStoreId, page);
  }

  @Get('load-categories')
  async loadCategories() {
    return this.productService.loadCategories();
  }

  @Post('create-category')
  async createCategory(
    @Body('newCategory') newCategory: string,
  ) {
    if (!newCategory) {
      throw new Error('O campo newCategory é obrigatórios.');
    }

    return this.productService.createCategory(newCategory);
  }

  @Get('load-sub-categories')
  async loadSubCategories(
    @Query('categoryId') categoryId: string) {
    return this.productService.loadSubCategories(categoryId);
  }

  @Post('create-sub-category')
  async createSubCategory(
    @Body('newSubCategory') newSubCategory: string,
    @Body('categoryId') categoryId: string,
  ) {
    if (!newSubCategory || !categoryId) {
      throw new Error('Os campos newSubCategory e categoryId são obrigatórios.');
    }

    return this.productService.createSubCategory(newSubCategory, categoryId);
  }
}
