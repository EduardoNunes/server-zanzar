import { Body, Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';
import { PurchasesService } from './purchases.service';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}
  
  @Get('get-user-purchases')
  async getUserPurchases(
    @Param('profileId') profileId: string,
    @Param('page') page: string,
    @Param('limit') limit: string,
  ) {
    const pageNumber = parseInt(page, 10) || 1;
    const limitNumber = parseInt(limit, 10) || 3;
    return this.purchasesService.getUserPurchases(
      profileId,
      pageNumber,
      limitNumber,
    );
  }
}
