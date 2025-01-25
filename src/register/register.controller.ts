import { Controller, Post, Body } from '@nestjs/common';
import { RegisterService } from './register.service';

@Controller('register')
export class RegisterController {
  constructor(private readonly registerService: RegisterService) {}

  @Post()
  async register(@Body() body: any) {
    return this.registerService.handleRegister(body);
  }
}
