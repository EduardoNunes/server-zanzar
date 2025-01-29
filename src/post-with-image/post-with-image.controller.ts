import {
  Controller,
  Post,
  Body,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Headers,
  Get,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './post-with-image.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('upload-and-create')
  @UseInterceptors(FileInterceptor('file'))
  async createPost(
    @UploadedFile() file: Express.Multer.File,
    @Body('userId') userId: string,
    @Body('caption') caption: string,
    @Headers('Authorization') token: string,
  ) {
    if (!token) {
      throw new HttpException(
        'Token de acesso não encontrado.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!file) {
      throw new HttpException('Arquivo não enviado.', HttpStatus.BAD_REQUEST);
    }

    const filePath = `${userId}/${Date.now()}_${file.originalname}`;

    return this.postsService.createPostWithMedia(
      file,
      filePath,
      userId,
      caption,
    );
  }

  @Get('get-all')
  async getAllPosts(@Query('userId') userId: string) {
    return this.postsService.getAllPosts(userId);
  }

  @Post('likes')
  async like(@Body() body: any) {
    return this.postsService.handleLike(body);
  }

  @Post('comments')
  async comments(@Body() body: any) {
    return this.postsService.addComments(body);
  }

  @Get('comments')
  async getComments(
    @Query('postId') postId: string,
    @Query('page') page: number = 1,
  ) {
    return this.postsService.get15comments(postId, page);
  }
}
