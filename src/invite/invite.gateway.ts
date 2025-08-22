import {
  WebSocketGateway,
  SubscribeMessage,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketManager } from '../common/websocket/websocket.manager';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class InviteGateway {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly wsManager: WebsocketManager,
  ) {}

  @SubscribeMessage('get-unread-invites')
  async handleGetUnreadInvites(client: any, profileId: string) {
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

  /**
   * Envia para todos os sockets conectados do usuário um evento de novo convite
   */
  emitNewInvite(profileId: string) {
    this.wsManager.emitToProfile(profileId, 'invite:new', { type: 'new_invite' });
  }
}
