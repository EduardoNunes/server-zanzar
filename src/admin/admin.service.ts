import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) { }

  async getPostsCount(): Promise<number> {
    return this.prisma.posts.count();
  }

  async getProductsCount(): Promise<number> {
    return this.prisma.product.count();
  }

  async getMessagesCount(): Promise<number> {
    return this.prisma.chatMessages.count();
  }

  async getAdvertisementsCount(): Promise<number> {
    return this.prisma.advertisements.count();
  }

  async getTotalUsers(): Promise<number> {
    return this.prisma.profiles.count();
  }

  async getPostsTotal() {
    return this.prisma.posts.count();
  }

  async getPosts24h() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    return this.prisma.posts.count({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo
        }
      }
    });
  }

  async getPosts7d() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.prisma.posts.count({
      where: {
        createdAt: {
          gte: sevenDaysAgo
        }
      }
    });
  }

  async getPosts30d() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return this.prisma.posts.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });
  }

  async getUsersCount() {
    return this.prisma.profiles.count();
  }
}
