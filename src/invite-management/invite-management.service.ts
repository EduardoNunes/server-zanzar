import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class InviteManagementService {
  constructor(private readonly prisma: PrismaService) { }

  async getAllInvites(page: number = 1) {
    const pageSize = 15;
    const skip = (page - 1) * pageSize;

    const invites = await this.prisma.invite.findMany({
      skip,
      take: pageSize,
      orderBy: {
        sentAt: 'desc',
      },
      include: {
        inviter: {
          select: {
            username: true,
          },
        },
      },
    });

    const totalInvites = await this.prisma.invite.count();

    return {
      data: invites,
      totalPages: Math.ceil(totalInvites / pageSize),
      currentPage: page,
    };
  }

  async createInvite(username: string, inviteCount: number) {
    const emailLowerCase = username.toLowerCase();
    try {
      if (inviteCount <= 0) {
        throw new Error("A quantidade de convites deve ser maior que zero.");
      }
  
      const profile = await this.prisma.profiles.findUnique({
        where: { username: emailLowerCase },
      });
  
      if (!profile) {
        throw new Error("Usuário não encontrado.");
      }
  
      const updatedProfile = await this.prisma.profiles.update({
        where: { username: emailLowerCase },
        data: {
          invites: {
            increment: inviteCount,
          },
        },
      });
  
      return { 
        success: true,
        message: `${inviteCount} ${inviteCount === 1 ? "convite adicionado" : "convites adicionados"} a ${emailLowerCase}. Convites totais: ${updatedProfile.invites}` 
      };
    } catch (error) {
      return { 
        success: false,
        error: error.message || "Erro desconhecido ao criar convite." 
      };
    }
  }
  


  async createInvitesToAll(inviteCount: number) {
    if (inviteCount <= 0) {
      throw new Error("A quantidade de convites deve ser maior que zero.");
    }

    // Atualiza todos os perfis de uma vez, incrementando os convites
    await this.prisma.profiles.updateMany({
      data: {
        invites: {
          increment: inviteCount,
        },
      },
    });

    return { message: `Foram enviados ${inviteCount} convites para todos os usuários.` };
  }

  async removeInvite(id: string) {
    const invite = await this.prisma.invite.findUnique({
      where: { id },
    });

    if (!invite) {
      throw new Error("Convite nao encontrado.");
    }

    await this.prisma.invite.delete({
      where: { id },
    });

    return { message: "Convite removido." };
  }
}
