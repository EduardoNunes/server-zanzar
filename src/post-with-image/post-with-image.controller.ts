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
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PostsService } from './post-with-image.service';
import { JwtAuthGuard } from 'src/auth/guard/JwtAuthGuard';

@UseGuards(JwtAuthGuard)
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post('upload-and-create')
  @UseInterceptors(FileInterceptor('file'))
  async createPost(
    @UploadedFile() file: Express.Multer.File,
    @Body('profileId') profileId: string,
    @Body('caption') caption: string,
    @Body('selectedCategory') selectedCategory: string,
    @Body('order') order: number,
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

    const filePath = `${profileId}/${Date.now()}_${file.originalname}`;

    return this.postsService.createPostWithMedia(
      file,
      filePath,
      profileId,
      caption,
      selectedCategory,
      order,
    );
  }

  @Get('get-all')
  async getAllPosts(
    @Query('profileId') profileId: string,
    @Query('page') page: number,
    @Query('limit') limit: number,
  ) {
    return this.postsService.getAllPosts(profileId, page, limit);
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

  @Get('get-single')
  async findSinglePost(
    @Query('postId') postId: string,
    @Query('profileId') profileId: string,
  ) {
    return this.postsService.findSinglePost(postId, profileId);
  }

  @Get('load-categories')
  async loadCategories(@Query('profileId') profileId: string) {
    return this.postsService.loadCategories(profileId);
  }

  @Post('category')
  async addCategory(
    @Body('newCategory') newCategory: string,
    @Body('profileId') profileId: string,
  ) {
    if (!newCategory || !profileId) {
      throw new Error('Os campos newCategory e profileId são obrigatórios.');
    }

    return this.postsService.addCategory(newCategory, profileId);
  }
}
