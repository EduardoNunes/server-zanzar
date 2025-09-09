import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { CancelationOrdersProcessor } from './cancelation-orders.processor';
import { UserCartModule } from 'src/user-cart/user-cart.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'cancelation-orders',
    }),
    UserCartModule,
  ],
  providers: [CancelationOrdersProcessor],
  exports: [],
})
export class CancelationOrdersModule {}
