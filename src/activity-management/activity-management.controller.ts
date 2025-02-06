import { Controller, Get, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ActivityManagementService } from './activity-management.service';
import { JwtAuthGuard } from '../auth/guard/JwtAuthGuard';
import { AdminGuard } from '../auth/guard/admin.guard';

@Controller('admin/activity')
@UseGuards(JwtAuthGuard, AdminGuard)
export class ActivityManagementController {
  constructor(private readonly activityManagementService: ActivityManagementService) {}

  @Get('users')
  async getUsersActivity() {
    try {
      const users = await this.activityManagementService.getUsersActivity();
      return users;
    } catch (error) {
      console.error('Error in getUsersActivity:', error);
      throw new HttpException(
        'Failed to fetch user activity',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get('stats')
  async getActivityStats() {
    try {
      const stats = await this.activityManagementService.getActivityStats();
      return stats;
    } catch (error) {
      console.error('Error in getActivityStats:', error);
      throw new HttpException(
        'Failed to fetch activity stats',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
