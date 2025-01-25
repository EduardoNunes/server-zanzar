import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RegisterService {
  constructor(private prisma: PrismaService) {}

  async handleRegister(data: any) {
    const { email, password, username } = data;

    try {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const existEmail = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existEmail) {
        throw new HttpException(
          'Este E-mail já está cadastrado',
          HttpStatus.BAD_REQUEST,
        );
      }

      const newUser = await this.prisma.user.create({
        data: {
          email,
          password: hashedPassword,
        },
      });

      const newProfile = await this.prisma.profiles.create({
        data: {
          username,
          role: 'user',
          userId: newUser.id,
        },
      });

      return {
        message: 'User registered successfully',
        email: newUser.email,
        id: newProfile.userId,
        userName: newProfile.username,
        role: newProfile.role,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}
