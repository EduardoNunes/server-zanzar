import { Injectable, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class AdvertisementsManagementService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private prisma: PrismaService) { }

  async getAdvertisements() {
    const advertisements = await this.prisma.advertisements.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // Get views and clicks counts for each advertisement
    const advertisementsWithCounts = await Promise.all(
      advertisements.map(async (ad) => {
        const viewsCount = await this.prisma.adViews.count({
          where: { adId: ad.id },
        });

        const clicksCount = await this.prisma.adClicks.count({
          where: { adId: ad.id },
        });


        return {
          ...ad,
          views_count: viewsCount,
          clicks_count: clicksCount,
        };
      })
    );
    // Generate signed URLs for advertisements
    const advertisementsWithSignedUrls = await Promise.all(
      advertisementsWithCounts.map(async (ad) => {
        try {
          let signedMediaUrl = null;

          if (ad.mediaUrl) {
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
              signedMediaUrl = data.signedUrl;
            }
          }

          return {
            ...ad,
            mediaUrl: signedMediaUrl || ad.mediaUrl
          };
        } catch (error) {
          console.error(
            `Unexpected error processing advertisement ${ad.id}:`,
            error,
          );
          return ad;
        }
      })
    );

    return advertisementsWithSignedUrls;
  }

  async getActiveAdvertisements() {
    const advertisements = await this.prisma.advertisements.findMany({
      where: { 
        active: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Generate signed URLs for advertisements
    const advertisementsWithSignedUrls = await Promise.all(
      advertisements.map(async (ad) => {
        try {
          let signedMediaUrl = null;

          if (ad.mediaUrl) {
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
              signedMediaUrl = data.signedUrl;
            }
          }

          return {
            ...ad,
            mediaUrl: signedMediaUrl || ad.mediaUrl
          };
        } catch (error) {
          console.error(
            `Unexpected error processing advertisement ${ad.id}:`,
            error,
          );
          return ad;
        }
      })
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
      console.log(`Parsing date: ${dateString}`);
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
    console.log("ID AQUI3", data)
    // Add date validation and parsing
    const parseDate = (dateString: string | undefined): Date | null => {
      console.log(`Parsing date: ${dateString}`);
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
    // Delete related records first
    await this.prisma.adViews.deleteMany({
      where: { id: id },
    });

    await this.prisma.adClicks.deleteMany({
      where: { id: id },
    });

    // Then delete the advertisement
    await this.prisma.advertisements.delete({
      where: { id },
    });   
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
        .from('zanzar-images')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
        });

      if (uploadError) {
        throw new BadRequestException('Failed to upload file');
      }

      // Get public URL
      const { data: { publicUrl } } = this.supabase.storage
        .from('zanzar-images')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw new BadRequestException('Failed to upload file');
    }
  }

  async createAdvertisementWithMedia(
    file: Express.Multer.File,
    data: any
  ) {
    try {
      // Generate unique file path
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `advertisements/${Date.now()}.${fileExtension}`;

      // Upload file to Supabase
      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from('zanzar-images')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
          });

      if (uploadError) {
        throw new HttpException(
          `Failed to upload media file: ${uploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Get public URL
      const { data: publicUrlData } = this.supabase.storage
        .from('zanzar-images')
        .getPublicUrl(uploadData?.path);

      const mediaUrl = publicUrlData?.publicUrl;

      if (!mediaUrl) {
        throw new HttpException(
          'Failed to get public URL for media',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Determine media type
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';

      // Add date validation and parsing
      const parseDate = (dateString: string | undefined): Date | null => {
        console.log(`Parsing date: ${dateString}`);
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
          scheduleStart: parseDate(data.scheduleStart),
          scheduleEnd: parseDate(data.scheduleEnd),
          showOnStartup: Boolean(data.showOnStartup),
          active: Boolean(data.active)
        }
      });

      return advertisement;
    } catch (error) {
      console.error('Error creating advertisement:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Failed to create advertisement',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async updateAdvertisementWithMedia(
    id: string,
    file: Express.Multer.File,
    data: any
  ) {
    try {
      // First, check if the advertisement exists
      const existingAd = await this.prisma.advertisements.findUnique({
        where: { id }
      });

      if (!existingAd) {
        throw new BadRequestException(`Advertisement with id ${id} not found`);
      }

      // Validate input data
      if (!data) {
        throw new BadRequestException('No update data provided');
      }

      // Generate unique file path
      const fileExtension = file.originalname.split('.').pop();
      const fileName = `advertisements/${Date.now()}.${fileExtension}`;

      // Upload file to Supabase
      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from('zanzar-images')
          .upload(fileName, file.buffer, {
            contentType: file.mimetype,
          });

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        throw new HttpException(
          `Failed to upload media file: ${uploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Get public URL
      const { data: publicUrlData } = this.supabase.storage
        .from('zanzar-images')
        .getPublicUrl(uploadData?.path);

      const mediaUrl = publicUrlData?.publicUrl;

      if (!mediaUrl) {
        throw new HttpException(
          'Failed to get public URL for media',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      // Determine media type
      const mediaType = file.mimetype.startsWith('video/') ? 'video' : 'image';

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
          title: data.title,
          description: data.description || null,
          mediaUrl: mediaUrl,
          mediaType: mediaType,
          linkUrl: data.linkUrl || null,
          startDate: parseDate(data.startDate),
          endDate: parseDate(data.endDate),
          dailyLimit: Number(data.dailyLimit) || null,
          scheduleStart: parseDate(data.scheduleStart),
          scheduleEnd: parseDate(data.scheduleEnd),
          showOnStartup: data.showOnStartup === 'true' || data.showOnStartup === true,
          active: data.active === 'true' || data.active === true
        }
      });

      console.log(`Successfully updated advertisement with id ${id}`);
      return advertisement;
    } catch (error) {
      console.error('Detailed error updating advertisement:', error);

      if (error instanceof HttpException || error instanceof BadRequestException) {
        throw error;
      }

      throw new HttpException(
        `Failed to update advertisement: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
