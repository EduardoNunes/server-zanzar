import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class WebSocketManager {
  private server: Server;
  private connectedUsers: Map<string, string> = new Map();

  setServer(server: Server) {
    this.server = server;
  }

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string;
    if (userId) {
      this.connectedUsers.set(userId, client.id);
      console.log(`Usuário conectado.: ${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    const userId = [...this.connectedUsers.entries()].find(
      ([, socketId]) => socketId === client.id,
    )?.[0];

    if (userId) {
      this.connectedUsers.delete(userId);
      console.log(`Usuário desconectado: ${userId}`);
    }
  }


  getSocketId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }

  emitToUser(userId: string, event: string, data: any) {
    const socketId = this.getSocketId(userId);
    if (socketId && this.server) {
      this.server.to(socketId).emit(event, data);
    }
  }

  getServer(): Server {
    return this.server;
  }
}
