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
import { InviteModule } from './invite/invite.module';
import { InviteManagementModule } from './invite-management/invite-management.module';
import { StoreModule } from './store/store.module';
import { ProductModule } from './product/product.module';
import { UserCartModule } from './user-cart/user-cart.module';
import { PurchasesModule } from './purchases/purchases.module';
import { AsaasModule } from './asaas/asaas.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
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
    InviteModule,
    InviteManagementModule,
    StoreModule,
    ProductModule,
    UserCartModule,
    PurchasesModule,
    AsaasModule
  ],
  controllers: [AppController, ChatController],
  providers: [AppService, ChatService],
})
export class AppModule {}
