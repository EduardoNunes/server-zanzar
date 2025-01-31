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

  @Get('user-profile/:username')
  async getProfile(@Param('username') username: string) {
    return this.profileService.getProfile(username);
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
}
