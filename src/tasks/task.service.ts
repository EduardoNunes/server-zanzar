import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UserCartService } from 'src/user-cart/user-cart.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly userCartService: UserCartService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async cancelUnpaidPixOrders() {
    this.logger.log('Verificando pedidos PIX não pagos...');
    await this.userCartService.cancelExpiredPixOrders();
  }
}
