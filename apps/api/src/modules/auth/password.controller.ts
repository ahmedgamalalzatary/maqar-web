import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiForbiddenResponse, ApiTags } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthResponse } from '@maqar/shared';
import { type AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto } from './dto/auth.dto.js';

/**
 * `PUT /v1/me/password` (phase 31): clients and admins change their own password; an advisor asks
 * the admin. Rate limited like sign-in, so a stolen session cannot guess the current password.
 */
@ApiTags('me')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard)
@Controller('me')
export class PasswordController {
  constructor(private readonly auth: AuthService) {}

  @Put('password')
  @Roles('client', 'admin')
  @ApiForbiddenResponse({ description: 'Wrong current password, or an advisor' })
  change(@CurrentUser() user: AuthUser, @Body() body: ChangePasswordDto): Promise<AuthResponse> {
    return this.auth.changePassword(user.id, body);
  }
}
