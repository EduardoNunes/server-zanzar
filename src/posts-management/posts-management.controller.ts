import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PostsManagementService } from './posts-management.service';
import { JwtAuthGuard } from '../auth/guard/JwtAuthGuard';
import { AdminGuard } from '../auth/guard/admin.guard';

@Controller('admin/posts')
@UseGuards(JwtAuthGuard, AdminGuard)
export class PostsManagementController {
  constructor(private readonly postsManagementService: PostsManagementService) {}

  @Get('total')
  async getPostsTotal() {
    try {
      const count = await this.postsManagementService.getPostsTotal();
      return { count };
    } catch (error) {
      console.error("Error in getPostsTotal:", error);
      throw error;
    }
  }

  @Get('24h')
  async getPosts24h() {
    try {
      const count = await this.postsManagementService.getPosts24h();
      return { count };
    } catch (error) {
      console.error("Error in getPosts24h:", error);
      throw error;
    }
  }

  @Get('7d')
  async getPosts7d() {
    try {
      const count = await this.postsManagementService.getPosts7d();
      return { count };
    } catch (error) {
      console.error("Error in getPosts7d:", error);
      throw error;
    }
  }

  @Get('30d')
  async getPosts30d() {
    try {
      const count = await this.postsManagementService.getPosts30d();
      return { count };
    } catch (error) {
      console.error("Error in getPosts30d:", error);
      throw error;
    }
  }

  @Get('all')
  async getAllPosts(@Query('page') page: string = '1') {
    try {
      const pageNumber = parseInt(page, 10);
      const posts = await this.postsManagementService.getAllPosts(pageNumber);
      return posts;
    } catch (error) {
      console.error("Error in getAllPosts:", error);
      throw error;
    }
  }
}