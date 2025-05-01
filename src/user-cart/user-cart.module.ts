import { Module } from '@nestjs/common';
import { UserCartService } from './user-cart.service';
import { UserCartController } from './user-cart.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [UserCartController],
  providers: [UserCartService, PrismaService],
})
export class UserCartModule {}
