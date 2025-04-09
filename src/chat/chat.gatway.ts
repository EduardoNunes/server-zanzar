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

    // Obter os participantes da conversa
    const conversation = await this.chatService.getConversation(
      data.conversationId,
    );
    const recipientId = conversation.participants.find(
      (p) => p.profileId !== data.profileId,
    )?.profileId;

    // Marcar mensagens como lidas apenas para o remetente
    await this.chatService.markConversationAsRead(
      data.conversationId,
      data.profileId,
    );

    // Emitir para a sala específica
    this.server.to(data.conversationId).emit('newMessage', message);

    // Emitir para o destinatário específico
    if (recipientId) {
      // Emitir para todos os sockets do destinatário
      const recipientSockets = Array.from(
        this.server.sockets.sockets.values(),
      ).filter((socket) => socket.handshake.query.userId === recipientId);

      console.log('Sockets do destinatário:', recipientSockets.length);

      recipientSockets.forEach((socket) => {
        socket.emit('newMessage', message);
        console.log('Evento newMessage emitido para socket:', socket.id);
      });

      // Obter o número de chats não lidos do destinatário
      const unreadChats =
        await this.chatService.getMyUnreadMessages(recipientId);
      recipientSockets.forEach((socket) => {
        socket.emit('unreadChatsCount', { count: unreadChats.length });
        console.log('Evento unreadChatsCount emitido para socket:', socket.id);
      });
    }

    return message;
  }

  // Marcar mensagem como lida
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @MessageBody() data: { messageId: string; profileId: string },
  ) {
    const readStatus = await this.chatService.markMessageAsRead(
      data.messageId,
      data.profileId,
    );
    this.server.emit('messageRead', readStatus);
    return readStatus;
  }

  // Marcar conversa como lida quando o usuário abre o chat
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

  @SubscribeMessage('getUnreadChatsCount')
  async handleGetUnreadChatsCount(@ConnectedSocket() client: Socket) {
    const profileId = client.handshake.query.userId as string;
    if (profileId) {
      const unreadChats = await this.chatService.getMyUnreadMessages(profileId);
      client.emit('unreadChatsCount', { count: unreadChats.length });
    }
  }
}
