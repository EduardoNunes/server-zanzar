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

    // variants já está estruturado como array de objetos
    const variants = Array.isArray(rawBody.variants) ? rawBody.variants : [rawBody.variants];

    // Associa arquivos enviados via multipart às imagens (se necessário)
    // Novo: Cria array auxiliar de metadados de imagens (position)
    const variantsImageMeta = [];
    variants.forEach((variant, vIdx) => {
      const metaArr = [];
      if (variant.images && Array.isArray(variant.images)) {
        variant.images = variant.images.map((img, imgIdx) => {
          // Salva o position do metadado
          metaArr.push({ position: img.position });
          // Se já for um arquivo válido (do multer), retorna ele
          if (img && typeof img === 'object' && img.buffer) {
            return img;
          }
          // Se img.file for um arquivo válido (do multer), retorna ele
          if (img.file && typeof img.file === 'object' && img.file.buffer) {
            return img.file;
          }
          // Se não, tenta encontrar no files[] pelo fieldname
          const fileObj = files.find(f => f.fieldname === `variants[${vIdx}][images][${imgIdx}]`);
          return fileObj;
        });
      }
      variantsImageMeta.push(metaArr);
    });

    const product = {
      name: rawBody.name,
      description: rawBody.description,
      selectedCategory: rawBody.selectedCategory,
      selectedSubCategory: rawBody.selectedSubCategory,
      profileId: rawBody.profileId,
      userStoreId: rawBody.userStoreId,
      variants,
      variantsImageMeta, // Novo campo
    };

    return this.productService.createProduct(product);
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
