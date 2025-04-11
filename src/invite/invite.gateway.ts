import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class InviteGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly prisma: PrismaService) {}

  @SubscribeMessage('get-unread-invites')
  async handleGetUnreadInvites(client: any, profileId: string) {
    console.log('PROFILEID', profileId);

    const { invites } = await this.prisma.profiles.findUnique({
      where: {
        id: profileId,
      },
      select: {
        invites: true,
      },
    });

    client.emit('unread-invites-count', { invites });
  }

  emitNewInvite(profileId: string) {
    this.server.emit(`invite:new:${profileId}`, { type: 'new_invite' });
  }
}
