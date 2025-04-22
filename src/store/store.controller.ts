import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FileInterceptor } from '@nestjs/platform-express';
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

  @Get(':slug')
  async getUserStore(
    @Param('slug') slug: string,
    @Query('profileId') profileId: string
  ) {
    return this.storeService.getUserStore(slug, profileId);
  }

  @Post('change-banner')
  @UseInterceptors(FileInterceptor('banner'))
  async updateProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('profileId') profileId: string,
    @Body('userStoreId') userStoreId: string,
  ) {
    if (!file) {
      throw new Error('Arquivo não enviado');
    }

    return this.storeService.updateBanner(profileId, file, userStoreId);
  }

  @Post('change-logo')
  @UseInterceptors(FileInterceptor('logo'))
  async updateLogo(
    @UploadedFile() file: Express.Multer.File,
    @Body('profileId') profileId: string,
    @Body('userStoreId') userStoreId: string,
  ) {
    if (!file) {
      throw new Error('Arquivo não enviado');
    }

    return this.storeService.updateLogo(profileId, file, userStoreId);
  }

  @Post('to-favorite-store')
  async favoriteStore(
    @Body('profileId') profileId: string,
    @Body('storeId') storeId: string,
  ) {
    return this.storeService.toFavoriteStore(profileId, storeId);
  }
}
