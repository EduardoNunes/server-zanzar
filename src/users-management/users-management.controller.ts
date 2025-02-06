import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UsersManagementService } from './users-management.service';
import { JwtAuthGuard } from '../auth/guard/JwtAuthGuard';
import { AdminGuard } from '../auth/guard/admin.guard';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersManagementController {
  constructor(private readonly usersManagementService: UsersManagementService) { }

  @Get('stats/total')
  async getUsersTotal() {
    try {
      console.log("Getting total users");
      const count = await this.usersManagementService.getUsersTotal();
      return { count };
    } catch (error) {
      console.error("Error in getUsersTotal:", error);
      throw error;
    }
  }

  @Get('stats/24h')
  async getActiveUsers24h() {
    try {
      console.log("Getting 24h active users");
      const count = await this.usersManagementService.getActiveUsers24h();
      return { count };
    } catch (error) {
      console.error("Error in getActiveUsers24h:", error);
      throw error;
    }
  }

  @Get('stats/7d')
  async getActiveUsers7d() {
    try {
      console.log("Getting 7d active users");
      const count = await this.usersManagementService.getActiveUsers7d();
      return { count };
    } catch (error) {
      console.error("Error in getActiveUsers7d:", error);
      throw error;
    }
  }

  @Get('stats/30d')
  async getActiveUsers30d() {
    try {
      console.log("Getting 30d active users");
      const count = await this.usersManagementService.getActiveUsers30d();
      return { count };
    } catch (error) {
      console.error("Error in getActiveUsers30d:", error);
      throw error;
    }
  }

  @Get()
  async getAllUsers(@Query('page') page: string = '1') {
    try {
      console.log("Getting all users, page:", page);
      const pageNumber = parseInt(page, 10);
      const users = await this.usersManagementService.getAllUsers(pageNumber);
      return users;
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      throw error;
    }
  }
}
