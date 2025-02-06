import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersManagementService {
  constructor(private prisma: PrismaService) { }

  async getUsersTotal() {
    return await this.prisma.profiles.count();
  }

  async getActiveUsers24h() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    return await this.prisma.profiles.count({
      where: {
        lastSignInAt: {
          gte: twentyFourHoursAgo
        }
      }
    });
  }

  async getActiveUsers7d() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return await this.prisma.profiles.count({
      where: {
        lastSignInAt: {
          gte: sevenDaysAgo
        }
      }
    });
  }

  async getActiveUsers30d() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return await this.prisma.profiles.count({
      where: {
        lastSignInAt: {
          gte: thirtyDaysAgo
        }
      }
    });
  }

  async getAllUsers(page: number = 1) {
    const usersPerPage = 10;
    const skip = (page - 1) * usersPerPage;

    const [users, total] = await Promise.all([
      this.prisma.profiles.findMany({
        select: {
          id: true,
          username: true,
          role: true,
          lastSignInAt: true,
          createdAt: true
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: usersPerPage
      }),
      this.prisma.profiles.count()
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / usersPerPage),
        hasMore: page * usersPerPage < total
      }
    };
  }
}
