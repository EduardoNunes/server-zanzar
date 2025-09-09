import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { UserCartService } from 'src/user-cart/user-cart.service';
import { Logger } from '@nestjs/common';

interface CancelOrderJobData {
  profileId: string;
  orderId: string;
  orderItemIds: string[];
}

@Processor('cancelation-orders')
export class CancelationOrdersProcessor {
  private readonly logger = new Logger(CancelationOrdersProcessor.name);

  constructor(private readonly userCartService: UserCartService) {}

  @Process('cancelation-orders')
  async handleCancelOrder(job: Job<CancelOrderJobData>) {
    const { profileId, orderId, orderItemIds } = job.data;
    this.logger.log(`Processando cancelamento do pedido ${orderId}`);
    console.log("CANCELAMENTO CHAMADO", profileId, orderId, orderItemIds)

    try {
      await this.userCartService.cancelPurchase(
        profileId,
        orderId,
        orderItemIds,
      );
      this.logger.log(`Pedido ${orderId} cancelado com sucesso.`);
    } catch (err) {
      this.logger.error(`Falha ao cancelar pedido ${orderId}: ${err.message}`);
    }
  }
}
