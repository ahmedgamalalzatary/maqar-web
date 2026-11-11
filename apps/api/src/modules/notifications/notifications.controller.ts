import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { NotificationItem, NotificationsResponse } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RateLimited } from '../../common/rate-limit.js';
import { DeletePushTokenDto, NotificationsQueryDto, PushTokenDto } from './dto/notifications.dto.js';
import { NotificationsService } from './notifications.service.js';

/** Router for `/v1/notifications`: the signed-in user's inbox (contract §8.13), for every role. */
@ApiTags('notifications')
@ApiBearerAuth()
@RateLimited()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: NotificationsQueryDto): Promise<NotificationsResponse> {
    return this.notifications.list(user.id, query.limit);
  }

  @Post('read-all')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Every notification is read' })
  readAll(@CurrentUser() user: AuthUser): Promise<void> {
    return this.notifications.markAllRead(user.id);
  }

  /** Sends the user a notification of their own, in the app and to their phones. */
  @Post('test')
  test(@CurrentUser() user: AuthUser): Promise<NotificationItem | null> {
    return this.notifications.sendTest(user.id);
  }

  @Post(':id/read')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Read' })
  @ApiNotFoundResponse({ description: 'Missing or someone else’s' })
  read(@CurrentUser() user: AuthUser, @Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.notifications.markRead(user.id, id);
  }
}

/** Router for `/v1/me/push-tokens`: the phones that get this account's pushes. */
@ApiTags('me')
@ApiBearerAuth()
@RateLimited()
@Controller('me/push-tokens')
export class PushTokensController {
  constructor(private readonly notifications: NotificationsService) {}

  /** Saving the same token again does nothing. */
  @Post()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'This phone gets the pushes' })
  save(@CurrentUser() user: AuthUser, @Body() body: PushTokenDto): Promise<void> {
    return this.notifications.saveToken(user.id, body.token, body.platform);
  }

  /** On sign-out: this phone stops getting the account's pushes. */
  @Delete()
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'This phone gets no more pushes' })
  remove(@CurrentUser() user: AuthUser, @Body() body: DeletePushTokenDto): Promise<void> {
    return this.notifications.deleteToken(user.id, body.token);
  }
}
