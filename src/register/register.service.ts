import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as Yup from 'yup';
import { registerValidation } from '../common/validations/register.validation';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RegisterService {
  constructor(private prisma: PrismaService) {}

  async handleRegister(data: any) {
    const { email, password, username } = data;

    try {
      await registerValidation.validate(
        { email, password },
        { abortEarly: false },
      );

      if (!/^[a-z0-9_]+$/.test(username)) {
        throw new HttpException(
          'Nome de usuário inválido, só é permitido letras minúsculas, números e underline',
          HttpStatus.BAD_REQUEST,
        );
      }

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

      //AQUI É A VALIDAÇÃO DE CONVITE.
      /* const existInvite = await this.prisma.invite.findFirst({
        where: { email },
      });

      if (!existInvite) {
        throw new HttpException(
          'Este email não foi convidado, busque um anfitrião.',
          HttpStatus.BAD_REQUEST,
        );
      } */

      const formattedUsername = username
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '_');

      const existName = await this.prisma.profiles.findUnique({
        where: { username: formattedUsername },
      });

      if (existName) {
        throw new HttpException(
          'Já existe um usuário com esse nome',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.prisma.$transaction(async (prisma) => {
        const newUser = await prisma.user.create({
          data: {
            email,
            password: hashedPassword,
          },
        });

        const newProfile = await prisma.profiles.create({
          data: {
            username,
            role: 'user',
            userId: newUser.id,
          },
        });

        /* const inviteAccepted = await prisma.invite.update({
          where: { id: existInvite.id },
          data: { status: 'accepted' },
        }); */

        return { newUser, newProfile/* , inviteAccepted  */};
      });

      return {
        message: 'User registered successfully',
        email: result.newUser.email,
        id: result.newProfile.userId,
        userName: result.newProfile.username,
        role: result.newProfile.role,
      };
    } catch (error) {
      if (error instanceof Yup.ValidationError) {
        throw new BadRequestException({
          statusCode: HttpStatus.BAD_REQUEST,
          message: error.errors,
          error: 'Validation Error',
        });
      }

      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message || 'Erro desconhecido',
        error: 'Bad Request',
      });
    }
  }
}
