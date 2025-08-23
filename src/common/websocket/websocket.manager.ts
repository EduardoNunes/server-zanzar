// src/common/websocket/websocket.manager.ts
import {
  OnModuleInit,
  OnModuleDestroy,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class WebsocketManager implements OnModuleInit, OnModuleDestroy {
  private server: Server;
  private clients: Map<string, Socket[]> = new Map(); // profileId -> sockets[]
  private readonly logger = new Logger(WebsocketManager.name);

  onModuleInit() {
    this.logger.log('WebsocketManager initialized');
  }

  onModuleDestroy() {
    this.logger.log('Cleaning up sockets...');
    this.clients.forEach((sockets) => sockets.forEach((s) => s.disconnect()));
    this.clients.clear();
  }

  setServer(server: Server) {
    this.server = server;
  }

  /** 🔹 Chamado pelos gateways quando um socket se conecta */
  handleConnection(client: Socket) {
    const profileId = client.handshake.auth?.profileId as string;
    if (!profileId) {
      this.logger.warn(`Socket connected without profileId: ${client.id}`);
      return;
    }

    this.addClient(profileId, client);
  }

  /** 🔹 Chamado pelos gateways quando um socket se desconecta */
  handleDisconnect(client: Socket) {
    const profileId = [...this.clients.entries()].find(([_, sockets]) =>
      sockets.some((s) => s.id === client.id),
    )?.[0];

    if (profileId) {
      this.removeClient(profileId, client);
    } else {
      this.logger.warn(
        `Disconnected socket not found in clients: ${client.id}`,
      );
    }
  }

  addClient(profileId: string, socket: Socket) {
    if (!this.clients.has(profileId)) {
      this.clients.set(profileId, []);
    }
    this.clients.get(profileId).push(socket);

    this.logger.debug(
      `Client connected: profileId=${profileId}, total=${this.clients.get(profileId).length}`,
    );
  }

  removeClient(profileId: string, socket: Socket) {
    if (!this.clients.has(profileId)) return;

    const sockets = this.clients
      .get(profileId)
      .filter((s) => s.id !== socket.id);

    if (sockets.length === 0) {
      this.clients.delete(profileId);
    } else {
      this.clients.set(profileId, sockets);
    }

    this.logger.debug(
      `Client disconnected: profileId=${profileId}, remaining=${sockets.length}`,
    );
  }

  /** 🔑 Emitir para um usuário/perfil específico */
  emitToProfile(profileId: string, event: string, payload: any) {
/*     this.logger.debug(
      `Emitindo para profileId=${profileId}, sockets=${this.clients.get(profileId)?.length || 0}`,
    ); */

    if (!this.clients.has(profileId)) {
      this.logger.warn(`No active sockets for profileId=${profileId}`);
      return;
    }

    this.clients.get(profileId).forEach((socket) => {
      socket.emit(event, payload);
    });
  }

  /** 🔹 Emitir para todos */
  broadcast(event: string, payload: any) {
    if (!this.server) return;
    this.server.emit(event, payload);
  }
}
