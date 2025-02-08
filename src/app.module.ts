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
import { AdminModule } from './admin/admin.module';
import { PostsManagementModule } from './posts-management/posts-management.module';
import { MessagesManagementModule } from './messages-management/messages-management.module';
import { UsersManagementModule } from './users-management/users-management.module';
import { ActivityManagementModule } from './activity-management/activity-management.module';
import { AdvertisementsManagementModule } from './advertisements-management/advertisements-management.module';
import { AdModalModule } from './ad-modal/ad-modal.module';

@Module({
  imports: [
    AuthModule,
    RegisterModule,
    PostsModule,
    ChatModule,
    ProfileModule,
    NotificationsModule,
    AdminModule,
    PostsManagementModule,
    MessagesManagementModule,
    UsersManagementModule,
    ActivityManagementModule,
    AdvertisementsManagementModule,
    AdModalModule,
  ],
  controllers: [AppController, ChatController],
  providers: [AppService, ChatService],
})
export class AppModule {}
