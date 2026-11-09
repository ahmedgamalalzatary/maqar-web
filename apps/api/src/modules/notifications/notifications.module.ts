import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../core/config/env.js';
import { UsersModule } from '../users/users.module.js';
import { NotificationsController, PushTokensController } from './notifications.controller.js';
import { NotificationsRepository } from './notifications.repository.js';
import { NotificationsService } from './notifications.service.js';
import { ExpoPushSender, MemoryPushSender, PushSender } from './push.sender.js';

/** Other modules import this and call `NotificationsService.notify` (contract §8.13). */
@Module({
  imports: [UsersModule],
  controllers: [NotificationsController, PushTokensController],
  providers: [
    NotificationsRepository,
    NotificationsService,
    {
      // Tests never reach Expo: they read what would have been sent.
      provide: PushSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('NODE_ENV', { infer: true }) === 'test'
          ? new MemoryPushSender()
          : new ExpoPushSender(config.get('EXPO_ACCESS_TOKEN', { infer: true })),
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
