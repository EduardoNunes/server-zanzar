import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { StoreService } from './store.service';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';
import { StoreDataProps } from 'src/types/story-types';

@Controller('store')
@UseGuards(JwtAuthGuard)
export class StoreController {
  constructor(private readonly storeService: StoreService) { }

  @Post('create')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'logo', maxCount: 1 },
      { name: 'banner', maxCount: 1 },
    ])
  )
  async createStore(
    @UploadedFiles()
    files: { logo?: Express.Multer.File[]; banner?: Express.Multer.File[] },

    @Body() formData: StoreDataProps,
    @Body('profileId') profileId: string
  ) {
    const logo = files.logo?.[0];
    const banner = files.banner?.[0];

    if (!logo || !banner) {
      throw new HttpException('Arquivos de logo e banner são obrigatórios', HttpStatus.BAD_REQUEST);
    }

    return this.storeService.createStore(formData, profileId, logo, banner);
  }
}
