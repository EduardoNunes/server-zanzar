import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.sub) {
      throw new ForbiddenException('Usuário não autenticado.');
    }

    const userProfile = await this.prisma.profiles.findFirst({
      where: { userId: user.sub },
      select: { role: true },
    });

    if (!userProfile) {
      throw new ForbiddenException('Usuário não encontrado no banco.');
    }

    if (userProfile.role !== 'admin') {
      throw new ForbiddenException('Acesso negado. Permissão insuficiente.');
    }

    return true;
  }
}
