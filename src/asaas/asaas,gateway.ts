import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AsaasGateway {
  @WebSocketServer()
  server: Server;

  notifyPaymentSuccess(profileIdSocket: string) {
    console.log('PROFILE ID GATEWAY', profileIdSocket);
    this.server.to(profileIdSocket).emit('payment-confirmed');
  }

  handleConnection(client: Socket) {
    const profileIdSocket = String(client.handshake.query.profileIdSocket);
    console.log('Socket conectado com profileIdSocket:', profileIdSocket);
    client.join(profileIdSocket);
  }
}
