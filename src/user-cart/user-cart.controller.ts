import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UserCartService } from './user-cart.service';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';

@Controller('user-cart')
@UseGuards(JwtAuthGuard)
export class UserCartController {
  constructor(private readonly userCartService: UserCartService) {}

  @Post('add-to-cart')
  async addToCart(@Body() body: any) {
    const { profileId, productId, variation, size, quantity } = body;

    return this.userCartService.addToCart(
      profileId,
      productId,
      variation,
      size,
      quantity,
    );
  }

  @Get('get-cart-products')
  async getCartProducts(@Query('profileId') profileId: string) {

    return this.userCartService.getCartProducts(profileId);
  }

  @Post('buy-products')
  async buyProducts(@Body() body: any) {
    const { profileId, selectedProducts } = body;

    return this.userCartService.buyProducts(profileId, selectedProducts);
  }
}
