import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { MessagesManagementService } from './messages-management.service';
import { JwtAuthGuard } from '../auth/guard/JwtAuthGuard';
import { AdminGuard } from '../auth/guard/admin.guard';

@Controller('admin/messages')
@UseGuards(JwtAuthGuard, AdminGuard)
export class MessagesManagementController {
  constructor(private readonly messagesManagementService: MessagesManagementService) { }

  @Get('stats/total')
  async getMessagesTotal() {
    try {
      const count = await this.messagesManagementService.getMessagesTotal();
      return { count };
    } catch (error) {
      console.error("Error in getMessagesTotal:", error);
      throw error;
    }
  }

  @Get('stats/24h')
  async getMessages24h() {
    try {
      const count = await this.messagesManagementService.getMessages24h();
      return { count };
    } catch (error) {
      console.error("Error in getMessages24h:", error);
      throw error;
    }
  }

  @Get('stats/7d')
  async getMessages7d() {
    try {
      const count = await this.messagesManagementService.getMessages7d();
      return { count };
    } catch (error) {
      console.error("Error in getMessages7d:", error);
      throw error;
    }
  }

  @Get('stats/30d')
  async getMessages30d() {
    try {
      const count = await this.messagesManagementService.getMessages30d();
      return { count };
    } catch (error) {
      console.error("Error in getMessages30d:", error);
      throw error;
    }
  }

  @Get()
  async getAllMessages(@Query('page') page: string = '1') {
    try {
      const pageNumber = parseInt(page, 10);
      const messages = await this.messagesManagementService.getAllMessages(pageNumber);
      return messages;
    } catch (error) {
      console.error("Error in getAllMessages:", error);
      throw error;
    }
  }
}
