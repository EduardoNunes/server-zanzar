import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
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

    const socketId = this.connectedUsers.get(profileId);

    if (socketId) {
      this.server.to(socketId).emit('newNotification', notification);
      console.log(`Notificação enviada para o usuário: ${profileId}`);
    } else {
      console.warn(`Usuário ${profileId} não está conectado.`);
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(client: Socket, notificationId: string) {
    const userId = client.handshake.query.userId as string;

    if (!userId) {
      throw new Error('Usuário não identificado.');
    }

    try {
      await this.notificationsService.markAsRead(notificationId);

      client.emit('notificationMarkedAsRead', { notificationId });

      console.log(
        `Notificação ${notificationId} marcada como lida pelo usuário ${userId}.`,
      );
    } catch (error) {
      console.error(`Erro ao marcar notificação como lida:`, error);
      client.emit('error', {
        message: 'Erro ao marcar notificação como lida.',
      });
    }
  }
}
