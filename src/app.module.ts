import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { RegisterModule } from './register/register.module';
import { PostsModule } from './post-with-image/post-with-image.module';
import { ChatController } from './chat/chat.controller';
import { ChatService } from './chat/chat.service';
import { ChatModule } from './chat/chat.module';
import { ProfileModule } from './profile/profile.module';
import { NotificationsModule } from './notifications/notifications.module';

@Module({
  imports: [AuthModule, RegisterModule, PostsModule, ChatModule, ProfileModule, NotificationsModule],
  controllers: [AppController, ChatController],
  providers: [AppService, ChatService],
})
export class AppModule {}
