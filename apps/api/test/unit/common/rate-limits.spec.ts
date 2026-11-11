import { Controller, Get } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import 'reflect-metadata';
import { ChatController } from '../../../src/modules/chat/chat.controller.js';
import { FavoritesController } from '../../../src/modules/favorites/favorites.controller.js';
import { AlertsController } from '../../../src/modules/prices/prices.controller.js';
import { ViewingsController } from '../../../src/modules/viewings/viewings.controller.js';
import { NotificationsController, PushTokensController } from '../../../src/modules/notifications/notifications.controller.js';
import { UploadsController } from '../../../src/modules/uploads/uploads.controller.js';

const guardsOf = (controller: Function): unknown[] => Reflect.getMetadata('__guards__', controller) ?? [];
const throttled = (controller: Function) => guardsOf(controller).some((g) => g === ThrottlerGuard || (g as Function | undefined)?.name === 'ThrottlerGuard');

// One cheap read route stands in for each controller, so the metadata is really attached.
@Controller('spec')
class SpecController {
  @Get()
  read(): void {}
}

describe('abuse-prone routes are rate limited', () => {
  it('guards chat, bookings, uploads, notifications, favorites and price alerts', () => {
    for (const controller of [ChatController, ViewingsController, UploadsController, NotificationsController, PushTokensController, FavoritesController, AlertsController]) {
      expect(throttled(controller), controller.name).toBe(true);
    }
  });

  it('does not throttle a plain public read controller', () => {
    expect(throttled(SpecController)).toBe(false);
  });
});
