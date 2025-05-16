import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AsaasService } from './asaas.service';
import { AsaasController } from './asaas.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AsaasGateway } from './asaas,gateway';

@Module({
  imports: [
    HttpModule.registerAsync({
      useFactory: () => ({
        baseURL: 'https://api-sandbox.asaas.com/v3',
      }),
    }),
  ],
  providers: [AsaasService, PrismaService, AsaasGateway],
  exports: [AsaasService],
  controllers: [AsaasController],
})
export class AsaasModule {}
