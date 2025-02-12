import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AdvertisementsManagementService } from './advertisements-management.service';
import { JwtAuthGuard } from '../auth/guard/JwtAuthGuard';
import { AdminGuard } from '../auth/guard/admin.guard';

@Controller('admin/advertisements')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdvertisementsManagementController {
  constructor(private readonly advertisementsService: AdvertisementsManagementService) { }

  @Get()
  async getAdvertisements() {
    try {
      const ads = await this.advertisementsService.getAdvertisements();
      return ads;
    } catch (error) {
      console.error('Error in getAdvertisements:', error);
      throw new HttpException(
        'Failed to fetch advertisements',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async createAdvertisement(
    @Body() data: any,
    @UploadedFile() file: Express.Multer.File
  ) {
    try {
      if (!file) {
        throw new HttpException(
          'No file uploaded',
          HttpStatus.BAD_REQUEST
        );
      }

      const ad = await this.advertisementsService.createAdvertisementWithMedia(file, data);
      return ad;
    } catch (error) {
      console.error('Error in createAdvertisement:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to create advertisement',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Put(':id')
  @UseInterceptors(FileInterceptor('file'))
  async updateAdvertisement(
    @Param('id') id: string,
    @Body() data: any,
    @UploadedFile() file: Express.Multer.File
  ) {
    try {
      if (!file) {
        throw new HttpException(
          'No file uploaded',
          HttpStatus.BAD_REQUEST
        );
      }

      const ad = await this.advertisementsService.updateAdvertisementWithMedia(id, file, data);
      return ad;
    } catch (error) {
      console.error('Error in updateAdvertisement:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to update advertisement',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Delete(':id')
  async deleteAdvertisement(@Param('id') id: string) {
    try {      
      await this.advertisementsService.deleteAdvertisement(id);
      return { message: 'Advertisement deleted successfully' };
    } catch (error) {
      console.error('Error in deleteAdvertisement:', error);
      throw new HttpException(
        'Failed to delete advertisement',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMedia(@UploadedFile() file: Express.Multer.File) {
    return this.advertisementsService.uploadAdvertisementMedia(file);
  }
}
