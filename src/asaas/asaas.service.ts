import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AsaasService {
  constructor(
    private readonly httpService: HttpService,
    private prisma: PrismaService,
  ) {}

  async createCustomer(
    profileId: string,
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
    const { fullName: name, cpf, phoneNumber: phone } = completeData;
    const cpfCnpj = cpf.replace(/[^\d]+/g, '');

    try {
      const profile = await this.prisma.profiles.findFirst({
        where: { id: profileId },
        include: {
          user: true,
        },
      });

      if (!profile) {
        throw new HttpException(
          {
            message: 'Perfil não encontrado.',
            statusCode: HttpStatus.NOT_FOUND,
          },
          HttpStatus.NOT_FOUND,
        );
      }

      const email = profile.user.email;

      // Verifica se cliente já existe no Asaas
      const checkResponse = await firstValueFrom(
        this.httpService.get('/customers', {
          params: { cpfCnpj },
          headers: {
            access_token: process.env.ASAAS_API_KEY,
          },
        }),
      );

      const existingCustomer = checkResponse.data?.data?.[0];

      if (existingCustomer) {
        return {
          message: 'Cliente já cadastrado no Asaas.',
          statusCode: HttpStatus.OK,
          customer: existingCustomer,
        };
      }

      // Cadastra novo cliente
      const customerData = { name, cpfCnpj, email, phone };

      const createResponse = await firstValueFrom(
        this.httpService.post('/customers', customerData, {
          headers: {
            access_token: process.env.ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
        }),
      );

      return {
        message: 'Cliente criado com sucesso no Asaas.',
        statusCode: HttpStatus.CREATED,
        customer: createResponse.data,
      };
    } catch (error) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const data = error.response?.data || 'Erro ao criar cliente no Asaas';

      throw new HttpException(
        {
          message: 'Erro ao criar cliente no Asaas.',
          details: data,
          statusCode: status,
        },
        status,
      );
    }
  }

  async createPixPayment(
    profileId: string,
    value: number,
    orderIdZanzar: string,
  ) {
    try {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 5);
      const expirationDate = now.toISOString();

      const profile = await this.prisma.profiles.findFirst({
        where: { id: profileId },
      });

      const customerData = await firstValueFrom(
        this.httpService.get('/customers', {
          params: { cpfCnpj: profile.cpf },
          headers: {
            access_token: process.env.ASAAS_API_KEY,
          },
        }),
      );

      const paymentData = {
        customer: customerData.data.data[0].id,
        billingType: 'PIX',
        value: value / 100,
        dueDate: now,
        expirationDate,
        description: 'Compra de produtos pelo Zanzar',
      };

      const response = await firstValueFrom(
        this.httpService.post('/payments', paymentData, {
          headers: {
            access_token: process.env.ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
        }),
      );

      const payment = response.data;

      await this.prisma.order.update({
        where: { id: orderIdZanzar },
        data: {
          asaasPaymentId: payment.id,
        },
      });

      const paymentPix = await firstValueFrom(
        this.httpService.get(`/payments/${payment.id}/pixQrCode`, {
          headers: {
            access_token: process.env.ASAAS_API_KEY,
            'Content-Type': 'application/json',
          },
        }),
      );

      return {
        message: 'Cobrança PIX criada com sucesso.',
        statusCode: 201,
        pix: {
          pixQrCode: paymentPix.data.encodedImage,
          pixCopyPasteKey: paymentPix.data.payload,
          expirationDate: paymentPix.data.expirationDate,
        },
        payment: {
          id: payment.id,
          value: payment.value,
          dueDate: payment.dueDate,
          status: payment.status,
        },
      };
    } catch (error) {
      const status = error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const data = error.response?.data || 'Erro ao criar pagamento PIX';

      throw new HttpException(
        {
          message: 'Erro ao criar pagamento PIX.',
          details: data,
          statusCode: status,
        },
        status,
      );
    }
  }

  async markAsPaid(paymentId: string) {
    try {
      const updatedOrder = await this.prisma.order.update({
        where: { asaasPaymentId: paymentId },
        data: {
          paymentStatus: 'PAGO',
        },
      });

      const updateOrderItems = await this.prisma.orderItem.updateMany({
        where: { orderId: updatedOrder.id },
        data: {
          status: 'PAGO',
        },
      });

      return updatedOrder;
    } catch (error) {
      console.error('Erro ao marcar pagamento como PAGO:', error.message);
      throw new HttpException(
        {
          message: 'Erro ao marcar pagamento como PAGO.',
          details: error.message,
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
