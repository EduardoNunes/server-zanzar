import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AdminGuard } from 'src/auth/guard/admin.guard';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';
import { InviteManagementService } from './invite-management.service';

@Controller('invite-management')
@UseGuards(JwtAuthGuard, AdminGuard)
export class InviteManagementController {
  constructor(private readonly inviteServiceManagement: InviteManagementService) { }

  @Get()
  async getInvites(@Query('page') page: string) {
    const pageNumber = Number(page) || 1;
    return this.inviteServiceManagement.getAllInvites(pageNumber);
  }

  @Post('invites-to-one')
  async createInvite(@Body() body) {
    const { username, inviteCount } = body;
    return this.inviteServiceManagement.createInvite(username, inviteCount);
  }
  
  @Post('invites-to-all') 
  async createInvitesToAll(@Body() body) {
    const { inviteCount } = body;
    return this.inviteServiceManagement.createInvitesToAll(inviteCount);
  }

  @Delete('remove-invite/:id')
  async removeInvite(@Param('id') id: string) {
    return this.inviteServiceManagement.removeInvite(id);
  }
}
