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

  constructor(private prisma: PrismaService) {}

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

      // Validação para cada anúncio
      for (const ad of ads) {
        if (
          ad.dailyLimit ||
          (ad.userLimitShow && profileId) ||
          (ad.timeInterval && profileId)
        ) {
          const todayStart = new Date(now);
          todayStart.setHours(0, 0, 0, 0);
          const todayEnd = new Date(now);
          todayEnd.setHours(23, 59, 59, 999);

          // Consulta única para recuperar todas as informações necessárias
          const adViews = await this.prisma.adViews.findMany({
            where: {
              adId: ad.id,
              profileId: profileId,
              lastView: { gte: todayStart, lte: todayEnd },
            }, // Para contagem diária

            orderBy: { lastView: 'desc' },
          });

          if (adViews.length === 0) {
            await this.prisma.$transaction([
              this.prisma.adViews.create({
                data: {
                  adId: ad.id,
                  profileId: profileId,
                  quantView: 1,
                  lastView: now,
                },
              }),

              this.prisma.advertisements.update({
                where: { id: ad.id },
                data: {
                  totalViews: { increment: 1 },
                },
              }),
            ]);
          } else {
            // Verifica limite diário
            if (ad.dailyLimit) {
              const viewsToday = adViews.filter(
                (view) =>
                  view.lastView >= todayStart && view.lastView <= todayEnd,
              ).length;

              if (viewsToday >= ad.dailyLimit) {
                continue;
              }
            }

            // Verifica limite de exibições por usuário
            if (ad.userLimitShow && profileId) {
              const userAdView = adViews.find(
                (view) => view.profileId === profileId,
              );

              if (userAdView && userAdView.quantView >= ad.userLimitShow) {
                continue;
              }
            }

            // Verifica intervalo de tempo entre visualizações
            if (ad.timeInterval && profileId) {
              const lastView = adViews.find(
                (view) => view.profileId === profileId && view.adId === ad.id,
              );

              if (lastView && lastView.lastView) {
                const nextAvailableView = new Date(lastView.lastView);
                nextAvailableView.setMinutes(
                  nextAvailableView.getMinutes() + ad.timeInterval,
                );

                if (now < nextAvailableView) {
                  continue;
                }
              }
            }

            await this.prisma.$transaction([
              this.prisma.adViews.updateMany({
                where: {
                  adId: ad.id,
                  profileId: profileId,
                },
                data: {
                  quantView: { increment: 1 },
                  lastView: now,
                },
              }),
              this.prisma.advertisements.update({
                where: { id: ad.id },
                data: {
                  totalViews: { increment: 1 },
                },
              }),
            ]);
          }
        }

        if (ad.mediaUrl) {
          try {
            const mediaPath = ad.mediaUrl.replace(
              `${process.env.SUPABASE_URL}/storage/v1/object/public/zanzar-images/`,
              '',
            );
            const { data, error } = await this.supabase.storage
              .from('zanzar-images')
              .createSignedUrl(mediaPath, 3600);

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

      return null;
    } catch (error) {
      this.logger.error('Error fetching eligible ad', error);
      throw error;
    }
  }

  async recordAdClick(adId: string, profileId?: string): Promise<void> {
    try {
      await this.prisma.$transaction([
        this.prisma.adViews.updateMany({
          where: { adId, profileId },
          data: {
            manyClicks: { increment: 1 },
          },
        }),
        this.prisma.advertisements.update({
          where: { id: adId },
          data: {
            totalClicks: { increment: 1 },
          },
        }),
      ]);
    } catch (error) {
      this.logger.error('Error recording ad click', error);
      throw error;
    }
  }
}
