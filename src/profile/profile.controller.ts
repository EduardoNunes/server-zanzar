import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('user-profile/:username')
  async getProfile(
    @Param('username') username: string,
    @Headers('authorization') authorizationHeader: string,
  ) {
    const token = authorizationHeader?.replace('Bearer ', '');

    if (!token) {
      throw new BadRequestException('Token de autorização ausente.');
    }

    return this.profileService.getProfile(username, token);
  }

  @Get('user-posts/:username')
  async getPosts(
    @Param('username') username: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('profileId') profileId?: string,
  ) {
    return this.profileService.getPosts(username, page, limit, profileId);
  }

  @Post('profile-image')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('profileId') profileId: string,
  ) {
    if (!file) {
      throw new Error('Arquivo não enviado');
    }

    return this.profileService.updateProfileImage(profileId, file);
  }

  @Post('follow-profile')
  async followProfile(
    @Body('profileId') profileId: string,
    @Body('currentProfileId') currentProfileId: string,
  ) {
    return this.profileService.followProfile(profileId, currentProfileId);
  }

  @Get('posts-by-category')
  async getPostsByCategory(
    @Query('categoryId') categoryId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
    @Query('profileId') profileId: string,
  ) {
    return this.profileService.getPostsByCategory(categoryId, profileId, page, limit);
  }
}
