import { Module } from '@nestjs/common';
import { WebsocketManager } from './websocket.manager';

@Module({
  providers: [WebsocketManager],
  exports: [WebsocketManager],
})

export class WebSocketModule {}
