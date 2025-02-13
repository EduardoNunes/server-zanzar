// chat.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({ cors: true })
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('joinChat')
  handleJoinChat(
    @MessageBody() data: { conversationId: string },
    @ConnectedSocket() client: Socket,
  ) {
    client.join(data.conversationId);
    console.log(`Client ${client.id} joined chat ${data.conversationId}`);
  }

  // Enviar mensagem
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody()
    data: { conversationId: string; profileId: string; content: string },
    @ConnectedSocket() client: Socket,
  ) {
    const message = await this.chatService.createMessage(data);
    this.server.to(data.conversationId).emit('newMessage', message);
    return message;
  }

  // Marcar mensagem como lida
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string; profileId: string },
  ) {
    const readStatus = await this.chatService.markMessageAsRead(data.messageId, data.profileId);
    this.server.emit('messageRead', readStatus);
    return readStatus;
  }

  // Editar mensagem
  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @MessageBody() data: { messageId: string; content: string },
  ) {
    const updatedMessage = await this.chatService.editMessage(data);
    this.server.emit('messageEdited', updatedMessage);
    return updatedMessage;
  }

  // Apagar mensagem
  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(@MessageBody() data: { messageId: string }) {
    const deletedMessage = await this.chatService.deleteMessage(data.messageId);
    this.server.emit('messageDeleted', deletedMessage);
    return deletedMessage;
  }

  // Gerenciar conexões de sala
  handleConnection(client: Socket) {
    console.log(`🔌 Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }
}
