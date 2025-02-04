import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@WebSocketGateway({ cors: true })
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(private notificationsService: NotificationsService) {}

  @WebSocketServer() server: Server;
  private connectedUsers: Map<string, string> = new Map();

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.connectedUsers.set(userId, client.id);
      console.log(`Usuário conectado: ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = Array.from(this.connectedUsers.entries()).find(
      ([_, socketId]) => socketId === client.id,
    )?.[0];
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`Usuário desconectado: ${userId}`);
    }
  }

  sendNotificationToUser(profileId: string, notification: any) {
    this.notificationsService.createNotification(notification);
console.log("GETWAY", profileId, notification)
    const socketId = this.connectedUsers.get(profileId);
    console.log('SOCKEDID', socketId, profileId, notification);
    if (socketId) {
      this.server.to(socketId).emit('newNotification', notification);
      console.log(`Notificação enviada para o usuário: ${profileId}`);
    } else {
      console.warn(`Usuário ${profileId} não está conectado.`);
    }
  }
}
