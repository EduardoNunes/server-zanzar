import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { UserCartService } from './user-cart.service';
import { UserCartController } from './user-cart.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/common/updateImage/supabase/supabase.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'cancelation-orders',
    }),
  ],
  controllers: [UserCartController],
  providers: [UserCartService, PrismaService, SupabaseService],
  exports: [UserCartService],
})
export class UserCartModule {}
