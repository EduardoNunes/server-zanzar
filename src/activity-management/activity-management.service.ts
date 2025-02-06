import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityManagementService {
  constructor(private prisma: PrismaService) {}

  async getUsersActivity() {
    // Get users with their last sign in and creation time
    const users = await this.prisma.profiles.findMany({
      select: {
        id: true,
        username: true,
        lastSignInAt: true,
        createdAt: true,
      },
      orderBy: {
        lastSignInAt: 'desc',
      },
      take: 50,
    });

    // Get post, message and likes counts for each user
    const usersWithActivity = await Promise.all(
      users.map(async (user) => {
        const postCount = await this.prisma.posts.count({
          where: { profileId: user.id },
        });

        const messageCount = await this.prisma.directMessages.count({
          where: { senderId: user.id },
        });

        const likesCount = await this.prisma.likes.count({
          where: { userId: user.id },
        });

        return {
          id: user.id,
          username: user.username,
          last_sign_in_at: user.lastSignInAt,
          created_at: user.createdAt,
          total_posts: postCount,
          total_messages: messageCount,
          total_likes: likesCount,
        };
      })
    );

    return usersWithActivity;
  }

  async getActivityStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get users active today
    const activeToday = await this.prisma.profiles.count({
      where: {
        lastSignInAt: {
          gte: today,
        },
      },
    });

    // Get users active this week
    const activeWeek = await this.prisma.profiles.count({
      where: {
        lastSignInAt: {
          gte: weekAgo,
        },
      },
    });

    // Get total sessions in the last week for average calculation
    const totalSessions = await this.prisma.profiles.count({
      where: {
        lastSignInAt: {
          gte: weekAgo,
        },
      },
    });

    return {
      totalActiveToday: activeToday,
      totalActiveWeek: activeWeek,
      averageSessionsPerDay: Math.round(totalSessions / 7),
    };
  }
}
