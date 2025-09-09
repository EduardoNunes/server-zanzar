import { BullModule } from '@nestjs/bull';

export const BullQueueModule = BullModule.forRoot({
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: Number(process.env.REDIS_PORT) || 6379,
  },
});
