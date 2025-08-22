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
import { WebsocketManager } from 'src/common/websocket/websocket.manager';

@WebSocketGateway({ cors: true })
@Injectable()
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly countAllNotificationsService: CountAllNotificationsService,
    private readonly wsManager: WebsocketManager, // injetando o manager
  ) {}

  async handleConnection(client: Socket) {
    this.wsManager.handleConnection(client); // registra a conexão no manager

    const userId = client.handshake.query.userId as string;
    if (userId) {
      // envia estatísticas ao conectar
      await this.sendUserStats(userId);
    }
  }

  handleDisconnect(client: Socket) {
    this.wsManager.handleDisconnect(client); // remove do manager
  }

  async sendNotificationToUser(profileId: string, notification: any) {
    await this.notificationsService.createNotification(notification);
    this.wsManager.emitToProfile(profileId, 'newNotification', notification);
    console.log(`Notificação enviada para o usuário: ${profileId}`);

    // Atualiza estatísticas
    await this.sendUserStats(profileId);
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(client: Socket, notificationId: string) {
    const userId = client.handshake.query.userId as string;
    if (!userId) throw new Error('Usuário não identificado.');

    try {
      await this.notificationsService.markAsRead(notificationId);
      client.emit('notificationMarkedAsRead', { notificationId });
      console.log(
        `Notificação ${notificationId} marcada como lida por ${userId}`,
      );

      await this.sendUserStats(userId);
    } catch (error) {
      console.error(`Erro ao marcar notificação como lida:`, error);
      client.emit('error', { message: 'Erro ao marcar notificação como lida.' });
    }
  }

  @SubscribeMessage('markAllAsRead')
  async handleMarkAllAsRead(client: Socket, profileId: string) {
    if (!profileId) throw new Error('Usuário não identificado.');

    try {
      await this.notificationsService.markAllAsRead(profileId);
      client.emit('allNotificationsMarkedAsRead');
      console.log(`Todas as notificações marcadas como lidas por ${profileId}`);

      await this.sendUserStats(profileId);
    } catch (error) {
      console.error(`Erro ao marcar todas notificações como lidas:`, error);
      client.emit('error', { message: 'Erro ao marcar todas notificações como lidas.' });
    }
  }

  @SubscribeMessage('requestUserStats')
  async getUnreadNotifications(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) await this.sendUserStats(userId);
  }

  async sendUserStats(profileId: string) {
    const { unreadNotifications, unreadChats, invitesCount } =
      await this.countAllNotificationsService.getAllCounts(profileId);

    this.wsManager.emitToProfile(profileId, 'userStatsUpdate', {
      unreadNotifications,
      unreadChats,
      invitesCount,
    });
  }
}
