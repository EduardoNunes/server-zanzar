import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PostsController } from './post-with-image.controller';
import { PostsService } from './post-with-image.service';

@Module({
  controllers: [PostsController],
  providers: [PostsService, PrismaService],
})
export class PostsModule {}
