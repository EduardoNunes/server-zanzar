// chat.controller.ts
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('create-chat')
  async createChat(
    @Body('data')
    data: {
      nameChat: string;
      profileId: string;
      selectedProfileId: string;
    },
  ) {
    const { nameChat, profileId, selectedProfileId } = data;

    return this.chatService.createChat(nameChat, profileId, selectedProfileId);
  }

  @Get('search-users')
  async getUsers(@Query('userName') userName: string) {
    return this.chatService.getUsers(userName);
  }

  @Get('followed-users/:profileId')
  async getFollowedUsers(@Param('profileId') profileId: string) {
    return this.chatService.getFollowedUsers(profileId);
  }

  @Get('user-chats/:id')
  async getUserChat(@Param('id') profileId: string) {
    return this.chatService.findUserChats(profileId);
  }

  // Obter mensagens de uma conversa
  @Get('conversation/:id/messages')
  async getConversationMessages(@Param('id') conversationId: string) {
    return this.chatService.getConversationMessages(conversationId);
  }

  // Criar uma nova mensagem (via REST)
  @Post('messages')
  async createMessage(
    @Body()
    data: {
      conversationId: string;
      profileId: string;
      content: string;
    },
  ) {
    return this.chatService.createMessage(data);
  }
}
