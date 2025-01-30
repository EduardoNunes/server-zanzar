import {
  Body,
  Controller,
  Get,
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

  @Get('user-profile/:userId')
  async getProfile(@Param('userId') userId: string) {
    return this.profileService.getProfile(userId);
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
    console.log('Controller', userId, file);

    if (!file) {
      throw new Error('Arquivo não enviado');
    }
    console.log('CONTROLLER', userId, file);
    return this.profileService.updateProfileImage(userId, file);
  }
}
