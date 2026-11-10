import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PropertiesModule } from '../properties/properties.module.js';
import { UsersModule } from '../users/users.module.js';
import { ViewingsModule } from '../viewings/viewings.module.js';
import { ChatController } from './chat.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatRealtime } from './chat.realtime.js';
import { ChatRepository } from './chat.repository.js';
import { ChatService } from './chat.service.js';

/** Live chat (contract §8.12, §10.3): HTTP for sending and history, a socket for live events. */
@Module({
  imports: [AuthModule, PropertiesModule, ViewingsModule, NotificationsModule, UsersModule],
  controllers: [ChatController],
  providers: [ChatRepository, ChatService, ChatRealtime, ChatGateway],
  exports: [ChatRepository],
})
export class ChatModule {}
