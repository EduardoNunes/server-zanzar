import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/JwtAuthGuard';
import { AdminGuard } from '../auth/guard/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) { }

  @Get('posts/count')
  async getPostsCount() {
    try {
      const count = await this.adminService.getPostsCount();
      return { count };
    } catch (error) {
      console.error("Error in getPostsCount:", error);
      throw error;
    }
  }

  @Get('products/count')
  async getProductsCount() {
    try {
      const count = await this.adminService.getProductsCount();
      return { count };
    } catch (error) {
      console.error("Error in getProductsCount:", error);
      throw error;
    }
  }

  @Get('messages/count')
  async getMessagesCount() {
    try {
      const count = await this.adminService.getMessagesCount();
      return { count };
    } catch (error) {
      console.error("Error in getMessagesCount:", error);
      throw error;
    }
  }

  @Get('advertisements/count')
  async getAdvertisementsCount() {
    try {
      const count = await this.adminService.getAdvertisementsCount();
      return { count };
    } catch (error) {
      console.error("Error in getAdvertisementsCount:", error);
      throw error;
    }
  }

  @Get('users/total')
  async getTotalUsers() {
    try {
      const count = await this.adminService.getTotalUsers();
      return { count };
    } catch (error) {
      console.error("Error in getTotalUsers:", error);
      throw error;
    }
  }
}
