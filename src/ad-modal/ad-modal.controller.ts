import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdModalService } from './ad-modal.service';
import { JwtAuthGuard } from '../auth/guard/JwtAuthGuard';
import { Request } from 'express';

@Controller('ad-modal')
export class AdModalController {
  constructor(private readonly adModalService: AdModalService) { }

  @Get('eligible')
  @UseGuards(JwtAuthGuard)
  async getEligibleAd(
    @Req() req: Request,
    @Query('profileId') profileId?: string,
  ) {
    const userId = req.user['id'];
    return this.adModalService.getEligibleAd(profileId || userId);
  }

  @Post('click')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async recordAdClick(
    @Req() req: Request,
    @Body() body: { adId: string; profileId?: string },
  ) {
    const userId = req.user['id'];
    await this.adModalService.recordAdClick(
      body.adId,
      body.profileId || userId,
    );
  }
}
