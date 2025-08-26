import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get('get-user-purchases')
  async getUserPurchases(
    @Query('profileId') profileId: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
  ) {
    console.log('DATA', profileId, page, limit);
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 3;
    return this.purchasesService.getUserPurchases(
      profileId,
      pageNumber,
      limitNumber,
    );
  }
}
