import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class PostsManagementService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(
    private prisma: PrismaService,
  ) { }

  async getPostsTotal() {
    return await this.prisma.posts.count();
  }

  async getPosts24h() {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    return await this.prisma.posts.count({
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

    return await this.prisma.posts.count({
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

    return await this.prisma.posts.count({
      where: {
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    });
  }

  async getAllPosts(page: number = 1) {
    const postsPerPage = 5;
    const skip = (page - 1) * postsPerPage;

    const [posts, total] = await Promise.all([
      this.prisma.posts.findMany({
        select: {
          id: true,
          mediaUrl: true,
          caption: true,
          createdAt: true,
          profile: {
            select: {
              username: true
            }
          },
          likes: {
            select: {
              id: true
            }
          },
          comments: {
            select: {
              id: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        skip,
        take: postsPerPage
      }),
      this.prisma.posts.count()
    ]);

    // Process posts to generate signed URLs
    const postsWithSignedUrls = await Promise.all(
      posts.map(async (post) => {
        try {
          let signedMediaUrl = null;

          if (post.mediaUrl) {
            const mediaPath = post.mediaUrl.replace(
              `${process.env.SUPABASE_URL}/storage/v1/object/public/zanzar-images/`,
              '',
            );
            const { data, error } = await this.supabase.storage
              .from('zanzar-images')
              .createSignedUrl(mediaPath, 3600);

            if (error) {
              console.error(
                `Error generating signed URL for post ${post.id}:`,
                error,
              );
            } else {
              signedMediaUrl = data.signedUrl;
            }
          }

          return {
            ...post,
            mediaUrl: signedMediaUrl || post.mediaUrl,
          };
        } catch (error) {
          console.error(`Error processing post ${post.id}:`, error);
          return post;
        }
      }),
    );

    return {
      posts: postsWithSignedUrls,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / postsPerPage),
        hasMore: page * postsPerPage < total
      }
    };
  }
}
