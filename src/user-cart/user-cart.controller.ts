import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserCartService } from './user-cart.service';

@Controller('user-cart')
export class UserCartController {
  constructor(private readonly userCartService: UserCartService) {}

}
