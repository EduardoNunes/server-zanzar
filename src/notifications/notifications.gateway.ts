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
import { CountAllNotificationsService } from './count-all-notifications.service';

@WebSocketGateway({ cors: true })
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly countAllNotificationsService: CountAllNotificationsService,
  ) {}

  @WebSocketServer() server: Server;
  private connectedUsers: Map<string, string> = new Map();

  // Quando um usuário se conecta
  async handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.connectedUsers.set(userId, client.id);
      console.log(`Usuário conectado: ${userId}`);

      // Enviar estatísticas ao conectar
      await this.sendUserStats(userId);
    }
  }

  // Quando um usuário se desconecta
  handleDisconnect(client: Socket) {
    const userId = Array.from(this.connectedUsers.entries()).find(
      ([_, socketId]) => socketId === client.id,
    )?.[0];
    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`Usuário desconectado: ${userId}`);
    }
  }

  // Enviar notificação para um usuário específico
  async sendNotificationToUser(profileId: string, notification: any) {
    await this.notificationsService.createNotification(notification);

    const socketId = this.connectedUsers.get(profileId);
    if (socketId) {
      this.server.to(socketId).emit('newNotification', notification);
      console.log(`Notificação enviada para o usuário: ${profileId}`);

      // Atualizar estatísticas após enviar notificação
      await this.sendUserStats(profileId);
    } else {
      console.warn(`Usuário ${profileId} não está conectado.`);
    }
  }

  // Marcar notificação como lida
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
        `Notificação ${notificationId} marcada como lida por ${userId}`,
      );

      // Atualizar estatísticas após marcar como lida
      await this.sendUserStats(userId);
    } catch (error) {
      console.error(`Erro ao marcar notificação como lida:`, error);
      client.emit('error', {
        message: 'Erro ao marcar notificação como lida.',
      });
    }
  }

  @SubscribeMessage('markAllAsRead')
  async handleMarkAllAsRead(client: Socket, profileId: string) {
    if (!profileId) {
      throw new Error('Usuário não identificado.');
    }

    try {
      await this.notificationsService.markAllAsRead(profileId);
      client.emit('allNotificationsMarkedAsRead');
      console.log(`Todas as notificações marcadas como lidas por ${profileId}`);

      // Atualizar estatísticas após marcar todas como lidas
      await this.sendUserStats(profileId);
    } catch (error) {
      console.error(`Erro ao marcar todas notificações como lidas:`, error);
      client.emit('error', {
        message: 'Erro ao marcar todas notificações como lidas.',
      });
    }
  }

  // Cliente pode solicitar atualização das estatísticas manualmente
  @SubscribeMessage('requestUserStats')
  async getUnreadNotifications(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      await this.sendUserStats(userId);
    }
  }

  // Método para enviar estatísticas ao usuário
  async sendUserStats(profileId: string) {
    // Chama a função unificada para obter todas as contagens de uma vez
    const { unreadNotifications, unreadChats, invitesCount } =
      await this.countAllNotificationsService.getAllCounts(profileId);

    const socketId = this.connectedUsers.get(profileId);
    if (socketId) {
      this.server.to(socketId).emit('userStatsUpdate', {
        unreadNotifications,
        unreadChats,
        invitesCount,
      });
    }
  }
}
