import { Module } from '@nestjs/common';
import { UserCartService } from './user-cart.service';
import { UserCartController } from './user-cart.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { SupabaseService } from 'src/common/updateImage/supabase/supabase.service';

@Module({
  controllers: [UserCartController],
  providers: [UserCartService, PrismaService, SupabaseService],
})
export class UserCartModule {}
