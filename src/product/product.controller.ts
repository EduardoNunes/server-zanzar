import {
  Controller,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';

@Controller('product')
@UseGuards(JwtAuthGuard)
export class ProductController {
  constructor() {}

  @Post('add-product')
  @UseInterceptors(AnyFilesInterceptor())
  async addProduct(
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: Request,
  ) {
    const rawBody = req.body;

    // Remove prototype null para garantir compatibilidade
    const body = JSON.parse(JSON.stringify(rawBody));

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

    // Debug
    console.log(
      'VARIANTS COM IMAGENS FORMATADAS:',
      variants.map((v) => ({
        ...v,
        images: v.images.map((img) => img.originalname),
      })),
    );

    return {
      message: 'Product added successfully',
      product: {
        ...body,
        variants,
      },
    };
  }
}
