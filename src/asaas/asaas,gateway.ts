import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { WebsocketManager } from '../common/websocket/websocket.manager';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AsaasGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly wsManager: WebsocketManager) {}

  handleConnection(@ConnectedSocket() client: Socket) {
    const profileId = client.handshake.auth?.profileId as string;
    if (!profileId) {
      console.warn(`Socket conectado sem profileId: ${client.id}`);
      return;
    }
    this.wsManager.addClient(profileId, client);
    console.log(`Socket conectado com profileId: ${profileId}`);
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    const profileId = client.handshake.auth?.profileId as string;
    if (!profileId) return;
    this.wsManager.removeClient(profileId, client);
    console.log(`Socket desconectado com profileId: ${profileId}`);
  }

  notifyPaymentSuccess(profileId: string) {
    console.log('PROFILE ID GATEWAY PAGAMENTO', profileId);
    this.wsManager.emitToProfile(profileId, 'payment-confirmed', {});
  }
}
