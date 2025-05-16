import {
  Body,
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';
import { AsaasService } from './asaas.service';
import { AsaasGateway } from './asaas,gateway';

@Controller('asaas')
export class AsaasController {
  constructor(
    private readonly asaasService: AsaasService,
    private readonly asaasGateway: AsaasGateway,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('create-customer/:profileId')
  async createCustomer(
    @Param('profileId') profileId: string,
    @Body()
    completeData: {
      fullName: string;
      birthDate: string;
      phoneNumber: string;
      cpf: string;
      addressId: string;
      address: {
        street: string;
        number: string;
        complement: string;
        neighborhood: string;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };
    },
  ) {
    return this.asaasService.createCustomer(profileId, completeData);
  }

  @UseGuards(JwtAuthGuard)
  @Post('create-payment-order/:profileId')
  async createPixPayment(
    @Param('profileId') profileId: string,
    @Body('value') value: number,
    @Body('orderIdZanzar') orderIdZanzar: string,
  ) {
    return this.asaasService.createPixPayment(profileId, value, orderIdZanzar);
  }

  @Post('webhook-payment')
  async handleWebhook(@Body() payload: any) {
    try {
      if (!payload?.payment?.status) {
        throw new HttpException(
          { message: 'Payload inválido', received: false },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (payload.payment.status === 'RECEIVED') {
        const payment = payload.payment;
        const paymentId = payment.id;

        const response = await this.asaasService.markAsPaid(paymentId);

        const profileIdSocket = response.profileId
        this.asaasGateway.notifyPaymentSuccess(profileIdSocket);

        return { received: true };
      }

      return { received: false, message: 'Evento não processado' };
    } catch (error) {
      console.error('Erro ao processar webhook:', error.message);
      throw new HttpException(
        {
          message: 'Erro ao processar webhook',
          details: error.message,
          received: false,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
