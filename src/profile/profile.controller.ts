import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
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

  @Get('user-posts/:userId')
  async getPosts(@Param('userId') userId: string) {
    return this.profileService.getPosts(userId);
  }

  @Post('profile-image')
  @UseInterceptors(FileInterceptor('avatar'))
  async updateProfileImage(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
  ) {
    if (!file) {
      throw new Error('Arquivo não enviado');
    }

    return this.profileService.updateProfileImage(userId, file);
  }

  @Post('follow-profile')
  async followProfile(
    @Body('userId') userId: string,
    @Body('profileId') profileId: string,
  ) {
    return this.profileService.followProfile(userId, profileId);
  }
}
