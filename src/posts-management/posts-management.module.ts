import { Module } from '@nestjs/common';
import { PostsManagementController } from './posts-management.controller';
import { PostsManagementService } from './posts-management.service';
import { PrismaModule } from '../prisma/prisma.module';
import { SupabaseModule } from 'src/common/updateImage/supabase/supabase.module';

@Module({
  imports: [PrismaModule, SupabaseModule],
  controllers: [PostsManagementController],
  providers: [PostsManagementService],
})
export class PostsManagementModule {}
