import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AdModalService {
  private readonly logger = new Logger(AdModalService.name);
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private prisma: PrismaService) { }

  async getEligibleAd(profileId?: string) {
    try {
      const now = new Date();
      const currentTime = now.toTimeString().split(' ')[0].slice(0, 5); // "HH:MM"

      // Criar um objeto `Date` baseado no horário atual do dia
      const today = new Date();
      const [hours, minutes] = currentTime.split(':').map(Number);
      const scheduleTime = new Date(today.setHours(hours, minutes, 0, 0));

      // Buscar os anúncios elegíveis
      const ads = await this.prisma.advertisements.findMany({
        where: {
          active: true,
          showOnStartup: true,
          startDate: { lte: now },
          endDate: { gte: now },
          OR: [
            { scheduleStart: null },
            {
              scheduleStart: { lte: scheduleTime },
              scheduleEnd: { gte: scheduleTime },
            },
          ],
        },
      });

      if (!ads || ads.length === 0) return null;

      // Check daily limits and generate signed URLs
      for (const ad of ads) {
        if (!ad.dailyLimit) {
          // Generate signed URL for media
          if (ad.mediaUrl) {
            try {
              const mediaPath = ad.mediaUrl.replace(
                'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/zanzar-images/',
                '',
              );
              const { data, error } = await this.supabase.storage
                .from('zanzar-images')
                .createSignedUrl(mediaPath, 3600);  // 1 hour expiration
              
              if (error) {
                console.error(
                  `Error generating signed URL for advertisement ${ad.id}:`,
                  error,
                );
              } else {
                ad.mediaUrl = data.signedUrl;
              }
            } catch (error) {
              console.error(
                `Unexpected error processing advertisement ${ad.id}:`,
                error,
              );
            }
          }
          return ad;
        }

        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const viewCount = await this.prisma.adViews.count({
          where: {
            adId: ad.id,
            viewedAt: { gte: todayStart },
          },
        });

        if (viewCount < ad.dailyLimit) {
          // Generate signed URL for media
          if (ad.mediaUrl) {
            try {
              const mediaPath = ad.mediaUrl.replace(
                'https://livpgjkudsvjcvapfcjq.supabase.co/storage/v1/object/public/zanzar-images/',
                '',
              );
              const { data, error } = await this.supabase.storage
                .from('zanzar-images')
                .createSignedUrl(mediaPath, 3600);  // 1 hour expiration
              
              if (error) {
                console.error(
                  `Error generating signed URL for advertisement ${ad.id}:`,
                  error,
                );
              } else {
                ad.mediaUrl = data.signedUrl;
              }
            } catch (error) {
              console.error(
                `Unexpected error processing advertisement ${ad.id}:`,
                error,
              );
            }
          }
          return ad;
        }
      }

      return null;
    } catch (error) {
      this.logger.error('Error fetching eligible ad', error);
      throw error;
    }
  }

  async recordAdView(adId: string, profileId?: string): Promise<void> {
    try {
      await this.prisma.adViews.create({
        data: {
          adId,
          profileId,
        },
      });
    } catch (error) {
      this.logger.error('Error recording ad view', error);
      throw error;
    }
  }

  async recordAdClick(adId: string, profileId?: string): Promise<void> {
    try {
      await this.prisma.adClicks.create({
        data: {
          adId,
          profileId,
        },
      });
    } catch (error) {
      this.logger.error('Error recording ad click', error);
      throw error;
    }
  }
}
