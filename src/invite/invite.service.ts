import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { profile } from 'console';
import { InviteGateway } from './invite.gateway';

@Injectable()
export class InviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inviteGateway: InviteGateway,
  ) {}

  async createInvite(inviterId: string, email: string) {
    const emailLowerCase = email.toLowerCase();
    const profile = await this.prisma.profiles.findFirst({
      where: { userId: inviterId },
      select: { id: true, invites: true },
    });

    if (!profile) {
      throw new NotFoundException('Perfil não encontrado.');
    }

    if (profile.invites <= 0) {
      throw new BadRequestException('Você não tem convites.');
    }

    const existUser = await this.prisma.user.findFirst({
      where: { email: emailLowerCase },
    });

    if (existUser) {
      throw new BadRequestException('Este usuário já é um Zanzeiro.');
    }

    const existInvite = await this.prisma.invite.findFirst({
      where: { email: emailLowerCase },
    });

    if (existInvite) {
      throw new BadRequestException('Este email já foi convidado.');
    }

    const [inviteDecrease, addInvite] = await this.prisma.$transaction([
      this.prisma.profiles.update({
        where: { id: profile.id },
        data: { invites: { decrement: 1 } },
      }),
      this.prisma.invite.create({
        data: {
          inviterId: profile.id,
          email: emailLowerCase,
        },
      }),
    ]);

    this.inviteGateway.emitNewInvite(profile.id);
    return { inviteDecrease, addInvite };
  }

  // Listar convites enviados pelo usuário
  async getInvitesByUser(userId: string) {
    const userProfile = await this.prisma.profiles.findUnique({
      where: { userId: userId },
    });

    if (!userProfile) {
      throw new Error('User profile not found');
    }

    const invites = await this.prisma.invite.findMany({
      where: { inviterId: userProfile.id },
      orderBy: { sentAt: 'desc' },
    });

    return {
      invites,
      invitesAvaliable: userProfile.invites,
    };
  }

  // Aceitar um convite
  async acceptInvite(email: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { email },
    });

    if (!invite) {
      throw new NotFoundException('Convite não encontrado.');
    }

    return this.prisma.invite.update({
      where: { email },
      data: { status: 'accepted', acceptedAt: new Date() },
    });
  }

  async handleGetUnreadInvites(client: any, profileId: string) {
    const { invites } = await this.prisma.profiles.findUnique({
      where: {
        id: profileId,
      },
      select: {
        invites: true,
      },
    });

    return invites;
  }  
}
