import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ProfileService } from './profile.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';

@Controller('profile')
@UseGuards(JwtAuthGuard)
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
    @Query('profileId') profileIdVisitant: string,
  ) {
    return this.profileService.getPosts(
      username,
      page,
      limit,
      profileIdVisitant,
    );
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
    return this.profileService.getPostsByCategory(
      categoryId,
      profileId,
      page,
      limit,
    );
  }

  @Get('get-user-data')
  async getUserData(@Query('profileId') profileId: string) {
    return this.profileService.getUserData(profileId);
  }

  @Put('update-user-data/:profileId')
  async updateUserData(
    @Param('profileId') profileId: string,
    @Body()
    completeData: {
      fullName: string;
      birthDate: string;
      phoneNumber: string;
      addressId: string;
      address: {
        street: string;
        number: string;
        complement: string;
        neighborhood: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };
    },
  ) {

    return this.profileService.updateUserData(
      profileId,
      completeData.fullName,
      completeData.birthDate,
      completeData.phoneNumber,
      completeData.addressId,
      completeData.address.street,
      completeData.address.number,
      completeData.address.complement,
      completeData.address.neighborhood,
      completeData.address.city,
      completeData.address.state,
      completeData.address.postalCode,
      completeData.address.country,
    );
  }
}
