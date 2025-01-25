import { Module } from '@nestjs/common';
import { RegisterController } from './register.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RegisterService } from './register.service';

@Module({
  imports: [PrismaModule],
  controllers: [RegisterController],
  providers: [RegisterService],
})
export class RegisterModule {}
