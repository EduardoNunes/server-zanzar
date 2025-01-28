import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RegisterModule } from './register/register.module';
import { FeedModule } from './feed/feed.module';
import { PostsModule } from './post-with-image/post-with-image.module';

@Module({
  imports: [AuthModule, RegisterModule, FeedModule, PostsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
