import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NOTIFICATIONS_LIMIT, PUSH_PLATFORMS, type PushPlatform, type PushTokenBody } from '@maqar/shared';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export class NotificationsQueryDto {
  @ApiPropertyOptional({ default: NOTIFICATIONS_LIMIT, maximum: NOTIFICATIONS_LIMIT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NOTIFICATIONS_LIMIT)
  limit?: number;
}

/** An Expo push token, as `getExpoPushTokenAsync` gives it. */
const EXPO_TOKEN = /^Expo(nent)?PushToken\[[\w-]{10,200}\]$/;

export class PushTokenDto implements PushTokenBody {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @Matches(EXPO_TOKEN, { message: 'token must be an Expo push token' })
  token: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  @IsIn(PUSH_PLATFORMS)
  platform: PushPlatform;
}

export class DeletePushTokenDto {
  @ApiProperty()
  @Matches(EXPO_TOKEN, { message: 'token must be an Expo push token' })
  token: string;
}
