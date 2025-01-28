import {Injectable,BadRequestException, } from '@nestjs/common';

  import { SupabaseService } from '../../common/updateImage/supabase/supabase.service';

  @Injectable()
  export class UpdateImageService {
    constructor(
      private supabaseService: SupabaseService,
    ) {}
  
    async uploadImage(file: Express.Multer.File): Promise<string | null> {
      const supabase = this.supabaseService.getSupabaseClient();
  
      const fileName = `${Date.now()}-${file.originalname}`;
  
      const { data, error } = await supabase.storage
        .from('images')
        .upload(fileName, file.buffer, {
          contentType: file.mimetype,
          upsert: true,
        });
  
      if (error) {
        throw new BadRequestException(
          `Erro ao fazer upload da imagem: ${error.message}`,
        );
      }
  
      const { data: publicData } = supabase.storage
        .from('images')
        .getPublicUrl(fileName);
      return publicData?.publicUrl || null;
    }

  }
  