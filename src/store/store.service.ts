import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from 'src/prisma/prisma.service';
import { StoreDataProps } from 'src/types/story-types';

@Injectable()
export class StoreService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private readonly prisma: PrismaService) { }

  async createStore(
    storeData: StoreDataProps,
    profileId: string,
    logo: Express.Multer.File,
    banner: Express.Multer.File
  ) {
    const { name, description, address } = storeData;
    const { street, number, complement, neighborhood, city, state, country, postalCode } = address;
    console.log("TYPEOF", typeof address)

    try {
      if (!name || !description) {
        throw new HttpException(
          'Nome e descrição da loja são obrigatórios.',
          HttpStatus.BAD_REQUEST
        );
      }

      const profile = await this.prisma.profiles.findUnique({
        where: { id: profileId },
      });

      if (!profile) {
        throw new HttpException('Usuário não encontrado.', HttpStatus.NOT_FOUND);
      }

      const userStoreName = await this.prisma.userStore.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
        },
      });

      if (userStoreName) {
        throw new HttpException('Já existe uma loja com esse nome.', HttpStatus.CONFLICT);
      }

      // Upload do LOGO
      const logoPath = `stores/logos/${Date.now()}-${logo.originalname}`;
      const { data: logoUploadData, error: logoUploadError } =
        await this.supabase.storage
          .from('zanzar-images')
          .upload(logoPath, logo.buffer, {
            contentType: logo.mimetype,
          });

      if (logoUploadError) {
        throw new HttpException(
          `Erro ao fazer upload do logo: ${logoUploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const { data: logoUrlData } = this.supabase.storage
        .from('zanzar-images')
        .getPublicUrl(logoUploadData.path);
      const logoUrl = logoUrlData?.publicUrl;

      // Upload do BANNER
      const bannerPath = `stores/banners/${Date.now()}-${banner.originalname}`;
      const { data: bannerUploadData, error: bannerUploadError } =
        await this.supabase.storage
          .from('zanzar-images')
          .upload(bannerPath, banner.buffer, {
            contentType: banner.mimetype,
          });

      if (bannerUploadError) {
        throw new HttpException(
          `Erro ao fazer upload do banner: ${bannerUploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const { data: bannerUrlData } = this.supabase.storage
        .from('zanzar-images')
        .getPublicUrl(bannerUploadData.path);
      const bannerUrl = bannerUrlData?.publicUrl;

      if (!logoUrl || !bannerUrl) {
        throw new HttpException(
          'Erro ao obter URLs públicas das imagens.',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }

      const [createdAddress, createdStore] = await this.prisma.$transaction(async (tx) => {
        let createdAddress = null;

        if (address) {
          const parsedAddress = typeof address === 'string' ? JSON.parse(address) : address;

          const {
            street,
            number,
            complement,
            neighborhood,
            city,
            state,
            country,
            postalCode,
          } = parsedAddress;

          createdAddress = await tx.address.create({
            data: {
              street,
              number,
              complement: complement || null,
              district: neighborhood,
              city,
              state,
              country,
              zipCode: postalCode,
            },
          });
        }

        const storeData: any = {
          name,
          slug: name.toLowerCase().replace(/\s+/g, '-'),
          description,
          logoUrl,
          bannerUrl,
          rating: 0,
          ratingCount: 0,
          totalRevenue: 0,
          isActive: false,
          productFeePercentage: 2,
          subscriptionAmount: 2000,
          profile: {
            connect: { id: profileId },
          },
        };

        if (createdAddress) {
          storeData.address = {
            connect: { id: createdAddress.id },
          };
        }

        const createdStore = await tx.userStore.create({ data: storeData });

        return [createdAddress, createdStore];
      });

      return { createdAddress, createdStore };

    } catch (error) {
      console.error(error);
      throw new HttpException(
        error.message || 'Erro ao criar loja.',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
