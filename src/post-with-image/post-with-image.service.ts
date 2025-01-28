import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  private supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY,
  );

  constructor(private readonly prisma: PrismaService) {}

  async createPostWithMedia(
    file: Express.Multer.File,
    filePath: string,
    userId: string,
    caption: string,
  ) {
    try {
      const profile = await this.prisma.profiles.findUnique({
        where: { userId },
      });

      if (!profile) {
        throw new HttpException(
          'Usuário não encontrado.',
          HttpStatus.NOT_FOUND,
        );
      }

      const { data: uploadData, error: uploadError } =
        await this.supabase.storage
          .from('zanzar-images')
          .upload(filePath, file.buffer, {
            contentType: file.mimetype,
          });

      if (uploadError) {
        throw new HttpException(
          `Erro ao fazer upload da imagem: ${uploadError.message}`,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      const { data: publicUrlData } = this.supabase.storage
        .from('zanzar-images')
        .getPublicUrl(uploadData?.path);

      const mediaUrl = publicUrlData?.publicUrl;

      if (!mediaUrl) {
        throw new HttpException(
          'Erro ao obter URL pública da imagem.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
 
      const newPost = await this.prisma.posts.create({
        data: {
          profileId: profile.id,
          mediaUrl,
          caption,
          isPublic: true,
        },
      });

      return newPost;
    } catch (error) {
      console.error('Erro ao criar post:', error);
      throw new HttpException(
        'Erro ao criar o post. Por favor, tente novamente.',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
