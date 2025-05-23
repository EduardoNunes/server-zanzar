import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AdvertisementsManagementService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );
  private bucketName = process.env.BUCKET_MIDIAS;

  constructor(private prisma: PrismaService) {}

  async getAdvertisements() {
    const advertisements = await this.prisma.advertisements.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // pegar contagem de visualizações e cliques para cada anúncio
    const advertisementsWithCounts = await Promise.all(
      advertisements.map(async (ad) => {
        //conta quantos usuários visualizaram o anúncio
        const usersViewsCount = await this.prisma.adViews.count({
          where: { adId: ad.id },
        });

        return {
          ...ad,
          usersViewsCount: usersViewsCount, //quantidade de usuários que visualizaram o anúncio
        };
      }),
    );
    // Generate signed URLs for advertisements
    const advertisementsWithSignedUrls = await Promise.all(
      advertisementsWithCounts.map(async (ad) => {
        try {
          let signedMediaUrl = null;

          if (ad.mediaUrl) {
            const mediaPath = ad.mediaUrl.replace(
              `${process.env.SUPABASE_URL}/storage/v1/object/public/${this.bucketName}/`,
              '',
            );
            const { data, error } = await this.supabase.storage
              .from(this.bucketName)
              .createSignedUrl(mediaPath, 3600); // 1 hour expiration

            if (error) {
              console.error(
                `Error generating signed URL for advertisement ${ad.id}:`,
                error,
              );
            } else {
              signedMediaUrl = data.signedUrl;
            }
          }

          return {
            ...ad,
            mediaUrl: signedMediaUrl || ad.mediaUrl,
          };
        } catch (error) {
          console.error(
            `Unexpected error processing advertisement ${ad.id}:`,
            error,
          );
          return ad;
        }
      }),
    );

    return advertisementsWithSignedUrls;
  }

  async createAdvertisement(data: any) {
    const {
      title,
      description,
      mediaUrl,
      mediaType,
      linkUrl,
      startDate,
      endDate,
      dailyLimit,
      scheduleStart,
      scheduleEnd,
      showOnStartup,
      active,
    } = data;

    // Add date validation and parsing
    const parseDate = (dateString: string | undefined): Date | null => {
      if (!dateString) return null;

      const parsedDate = new Date(dateString);

      // Check if the date is valid
      if (isNaN(parsedDate.getTime())) {
        console.error(`Invalid date provided: ${dateString}`);
        throw new BadRequestException(`Invalid date provided: ${dateString}`);
      }

      return parsedDate;
    };

    return this.prisma.advertisements.create({
      data: {
        title,
        description,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        linkUrl: linkUrl,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        dailyLimit: Number(dailyLimit),
        scheduleStart: parseDate(scheduleStart),
        scheduleEnd: parseDate(scheduleEnd),
        showOnStartup: showOnStartup,
        active,
      },
    });
  }

  async updateAdvertisement(id: string, data: any) {
    const {
      title,
      description,
      mediaUrl,
      mediaType,
      linkUrl,
      startDate,
      endDate,
      dailyLimit,
      scheduleStart,
      scheduleEnd,
      showOnStartup,
      active,
    } = data;

    // Add date validation and parsing
    const parseDate = (dateString: string | undefined): Date | null => {
      if (!dateString) return null;

      const parsedDate = new Date(dateString);

      // Check if the date is valid
      if (isNaN(parsedDate.getTime())) {
        console.error(`Invalid date provided: ${dateString}`);
        throw new BadRequestException(`Invalid date provided: ${dateString}`);
      }

      return parsedDate;
    };

    return this.prisma.advertisements.update({
      where: { id },
      data: {
        title,
        description,
        mediaUrl: mediaUrl,
        mediaType: mediaType,
        linkUrl: linkUrl,
        startDate: parseDate(startDate),
        endDate: parseDate(endDate),
        dailyLimit: dailyLimit,
        scheduleStart: parseDate(scheduleStart),
        scheduleEnd: parseDate(scheduleEnd),
        showOnStartup: showOnStartup,
        active,
      },
    });
  }

  async deleteAdvertisement(id: string) {
    try {
      // First, check if the advertisement exists
      const existingAd = await this.prisma.advertisements.findUnique({
        where: { id },
      });

      if (!existingAd) {
        throw new BadRequestException(`Advertisement with id ${id} not found`);
      }

      // If the advertisement has a media URL, attempt to delete from Supabase storage
      if (existingAd.mediaUrl) {
        try {
          // Extract the file path from the mediaUrl
          const mediaPath = existingAd.mediaUrl.split('/').slice(3).join('/');

          const { error: deleteError } = await this.supabase.storage
            .from(this.bucketName)
            .remove([mediaPath]);

          if (deleteError) {
            console.warn(
              `Could not delete media file for advertisement ${id}:`,
              deleteError,
            );
          }
        } catch (storageError) {
          console.error(
            `Error attempting to delete media for advertisement ${id}:`,
            storageError,
          );
        }
      }

      // Delete related records to handle foreign key constraints
      await this.prisma.adViews.deleteMany({
        where: { adId: id },
      });

      // Delete the advertisement from the database
      const deletedAd = await this.prisma.advertisements.delete({
        where: { id },
      });

      console.log(`Successfully deleted advertisement with id ${id}`);
      return deletedAd;
    } catch (error) {
      console.error(`Error deleting advertisement with id ${id}:`, error);

      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new HttpException(
        `Failed to delete advertisement: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async uploadAdvertisementMedia(file: Express.Multer.File): Promise<string> {
    try {
      // Determine file type
      const fileType = file.mimetype.startsWith('video/') ? 'video' : 'image';

      // Create unique file name
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `ads/${fileName}`;

      // Upload file to Supabase storage
      const { error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) {
        throw new BadRequestException('Failed to upload file');
      }

      // Get public URL
      const {
        data: { publicUrl },
      } = this.supabase.storage.from(this.bucketName).getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  async createAdvertisementWithMedia(
    file: Express.Multer.File | undefined,
    data: any,
  ) {
    try {
      let mediaUrl: string | null = null;
      let mediaType: 'image' | 'video' | null = null;

      if (file) {
        // Gerar caminho de arquivo único
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `advertisements/${Date.now()}.${fileExtension}`;

        // Upload arquivo para o Supabase
        const { data: uploadData, error: uploadError } =
          await this.supabase.storage
            .from(this.bucketName)
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
            });

        if (uploadError) {
          throw new HttpException(
            `Failed to upload media file: ${uploadError.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        // Get public URL
        const { data: publicUrlData } = this.supabase.storage
          .from(this.bucketName)
          .getPublicUrl(uploadData?.path);

        mediaUrl = publicUrlData?.publicUrl;

        if (!mediaUrl) {
          throw new HttpException(
            'Failed to get public URL for media',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      } else {
        console.log('Nenhum arquivo foi enviado. Criando anúncio sem mídia.');
      }

      // adiciona validação e análise de data
      const parseDate = (dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        const parsedDate = new Date(dateString);
        // Check if the date is valid
        if (isNaN(parsedDate.getTime())) {
          console.error(`Invalid date provided: ${dateString}`);
          throw new BadRequestException(`Invalid date provided: ${dateString}`);
        }
        return parsedDate;
      };

      // Create advertisement
      const advertisement = await this.prisma.advertisements.create({
        data: {
          title: data.title,
          description: data.description || null,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          linkUrl: data.linkUrl || null,
          startDate: parseDate(data.startDate),
          endDate: parseDate(data.endDate),
          dailyLimit: Number(data.dailyLimit) || null,
          timeInterval: Number(data.timeInterval) || null,
          userLimitShow: Number(data.userLimitShow) || null,
          scheduleStart: parseDate(data.scheduleStart),
          scheduleEnd: parseDate(data.scheduleEnd),
          showOnStartup: data.showOnStartup === 'true' ? true : false,
          active: data.active === 'true' ? true : false,
        },
      });

      return advertisement;
    } catch (error) {
      console.error('Error creating advertisement:', error);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create advertisement',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async updateAdvertisementWithMedia(
    id: string,
    file: Express.Multer.File | undefined,
    data: any,
  ) {
    try {
      const existingAd = await this.prisma.advertisements.findUnique({
        where: { id },
      });

      if (!existingAd) {
        throw new BadRequestException(`Advertisement with id ${id} not found`);
      }

      if (!data) {
        throw new BadRequestException('No update data provided');
      }

      let mediaUrl: string | null = existingAd.mediaUrl; // Mantém o valor existente
      let mediaType: string | null = existingAd.mediaType; // Mantém o valor existente

      // Process new file if provided
      if (file) {
        // Generate unique file path
        const fileExtension = file.originalname.split('.').pop();
        const fileName = `advertisements/${Date.now()}.${fileExtension}`;

        // Upload file to Supabase
        const { data: uploadData, error: uploadError } =
          await this.supabase.storage
            .from(this.bucketName)
            .upload(fileName, file.buffer, {
              contentType: file.mimetype,
            });

        if (uploadError) {
          console.error('Supabase upload error:', uploadError);
          throw new HttpException(
            `Failed to upload media file: ${uploadError.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        // Get public URL
        const { data: publicUrlData } = this.supabase.storage
          .from(this.bucketName)
          .getPublicUrl(uploadData?.path);

        mediaUrl = publicUrlData?.publicUrl;

        if (!mediaUrl) {
          throw new HttpException(
            'Failed to get public URL for media',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';
      }

      // Add date validation and parsing
      const parseDate = (dateString: string | undefined): Date | null => {
        if (!dateString) return null;
        const parsedDate = new Date(dateString);
        // Check if the date is valid
        if (isNaN(parsedDate.getTime())) {
          console.error(`Invalid date provided: ${dateString}`);
          throw new BadRequestException(`Invalid date provided: ${dateString}`);
        }
        return parsedDate;
      };

      // Careful type conversion
      const dailyLimit = data.dailyLimit ? Number(data.dailyLimit) : null;
      if (dailyLimit !== null && isNaN(dailyLimit)) {
        throw new BadRequestException('Invalid daily limit value');
      }

      // Update advertisement
      const advertisement = await this.prisma.advertisements.update({
        where: { id },
        data: {
          title: data.title || existingAd.title,
          description: data.description || existingAd.description,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          linkUrl: data.linkUrl || existingAd.linkUrl,
          startDate: parseDate(data.startDate) || existingAd.startDate,
          endDate: parseDate(data.endDate) || existingAd.endDate,
          dailyLimit: dailyLimit || existingAd.dailyLimit,
          timeInterval: Number(data.timeInterval) || null,
          userLimitShow: Number(data.userLimitShow) || null,
          scheduleStart:
            parseDate(data.scheduleStart) || existingAd.scheduleStart,
          scheduleEnd: parseDate(data.scheduleEnd) || existingAd.scheduleEnd,
          showOnStartup:
            data.showOnStartup === 'true' || data.showOnStartup === true,
          active: data.active === 'true' || data.active === true,
        },
      });

      return advertisement;
    } catch (error) {
      console.error('Detailed error updating advertisement:', error);
      if (
        error instanceof HttpException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new HttpException(
        `Failed to update advertisement: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
