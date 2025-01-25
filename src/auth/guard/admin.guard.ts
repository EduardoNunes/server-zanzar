import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    if (user.role !== 'admin') {
      throw new ForbiddenException('Acesso negado. Você não é admin.');
    }

    const id = Number(user.userId);

    const userRole = await this.prisma.profiles.findUnique({
      where: { id: user.userId },
      select: { role: true },
    });

    if (!userRole) {
      throw new ForbiddenException('Usuário não encontrado no banco.');
    }

    if (userRole.role !== 'admin') {
      throw new ForbiddenException('Acesso negado. Permissão insuficiente.');
    }

    return true;
  }
}
