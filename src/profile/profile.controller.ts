import { Controller, Get, Param } from '@nestjs/common';
import { ProfileService } from './profile.service';

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
}
