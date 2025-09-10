/* import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';
import { InjectQueue } from '@nestjs/bull';

export interface CancelOrderJobData {
  profileId: string;
  orderId: string;
  orderItemIds: string[];
}

@Injectable()
export class CancelationOrdersService {
  constructor(
    @InjectQueue('cancelation-orders') private readonly ordersQueue: Queue,
  ) {}

  async scheduleCancel(orderData: CancelOrderJobData, delay = 5 * 60 * 1000) {
    // Agenda cancelamento do pedido
    await this.ordersQueue.add('cancelation-orders', orderData, {
      delay,
      removeOnComplete: true,
      removeOnFail: true,
    });
  }
}
 */