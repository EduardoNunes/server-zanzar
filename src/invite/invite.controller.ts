import { Controller, Post, Get, Body, Param, Req, UseGuards } from '@nestjs/common';
import { InviteService } from './invite.service';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';

@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InviteController {
  constructor(private readonly inviteService: InviteService) { }

  @Post('send-invite')
  async createInvite(@Req() req, @Body() body) {
    return this.inviteService.createInvite(req.user.sub, body.email);
  }

  @Get()
  async getInvites(@Req() req) {
    return this.inviteService.getInvitesByUser(req.user.sub);
  }

  @Post('accept/:email')
  async acceptInvite(@Param('email') email: string) {
    return this.inviteService.acceptInvite(email);
  }
}
