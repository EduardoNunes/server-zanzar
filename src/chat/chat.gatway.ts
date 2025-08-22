// chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { WebsocketManager } from '../common/websocket/websocket.manager';

@WebSocketGateway({ cors: true })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly chatService: ChatService,
    private readonly wsManager: WebsocketManager, // injetamos o manager
  ) {}

  // 🔌 Conexão
  handleConnection(client: Socket) {
    const profileId = client.handshake.query.userId as string;
    if (profileId) {
      this.wsManager.addClient(profileId, client);
      console.log(`Cliente conectado: ${client.id}, ProfileID: ${profileId}`);
    }
  }

  // ❌ Desconexão
  handleDisconnect(client: Socket) {
    const profileId = client.handshake.query.userId as string;
    if (profileId) {
      this.wsManager.removeClient(profileId, client);
      console.log(
        `Cliente desconectado: ${client.id}, ProfileID: ${profileId}`,
      );
    }
  }

  @SubscribeMessage('joinChat')
  handleJoinChat(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.conversationId);
    console.log(`Client ${client.id} joined chat ${data.conversationId}`);
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: { conversationId: string; profileId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const message = await this.chatService.createMessage(data);

    // Emitir para a sala específica
    this.server.to(data.conversationId).emit('newMessage', message);

    // Emitir para o destinatário específico usando o WebsocketManager
    const conversation = await this.chatService.getConversation(
      data.conversationId,
    );
    const recipientId = conversation.participants.find(
      (p) => p.profileId !== data.profileId,
    )?.profileId;

    if (recipientId) {
      this.wsManager.emitToProfile(recipientId, 'newMessage', message);

      const unreadChats =
        await this.chatService.getMyUnreadMessages(recipientId);
      this.wsManager.emitToProfile(recipientId, 'unreadChatsCount', {
        count: unreadChats.length,
      });
    }

    return message;
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string; profileId: string },
  ) {
    const readStatus = await this.chatService.markMessageAsRead(
      data.messageId,
      data.profileId,
    );
    this.wsManager.emitToProfile(data.profileId, 'messageRead', readStatus);
    return readStatus;
  }

  @SubscribeMessage('openChat')
  async handleOpenChat(
    @MessageBody() data: { conversationId: string; profileId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const readResult = await this.chatService.markConversationAsRead(
      data.conversationId,
      data.profileId,
    );
    client.emit('conversationRead', readResult);
    return readResult;
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const updatedMessage = await this.chatService.editMessage(data);
    this.wsManager.broadcast('messageEdited', updatedMessage);
    return updatedMessage;
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(@MessageBody() data: { messageId: string }) {
    const deletedMessage = await this.chatService.deleteMessage(data.messageId);
    this.wsManager.broadcast('messageDeleted', deletedMessage);
    return deletedMessage;
  }

  @SubscribeMessage('getUnreadChatsCount')
  async handleGetUnreadChatsCount(@ConnectedSocket() client: Socket) {
    const profileId = client.handshake.query.userId as string;
    if (profileId) {
      const unreadChats = await this.chatService.getMyUnreadMessages(profileId);
      client.emit('unreadChatsCount', { count: unreadChats.length });
    }
  }
}
