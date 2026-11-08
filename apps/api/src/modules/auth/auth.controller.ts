import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthResponse } from '@maqar/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { RefreshDto, SignInDto, SignUpDto } from './dto/auth.dto.js';

/** Router for `/v1/auth`. Sign-up and sign-in are rate limited per IP (contract §15). */
@ApiTags('auth')
@Public()
@UseGuards(ThrottlerGuard)
@ApiTooManyRequestsResponse({ description: 'Too many attempts; wait a minute' })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sign-up')
  signUp(@Body() body: SignUpDto): Promise<AuthResponse> {
    return this.auth.signUp(body);
  }

  @Post('sign-in')
  @HttpCode(200)
  signIn(@Body() body: SignInDto): Promise<AuthResponse> {
    return this.auth.signIn(body);
  }

  @Post('refresh')
  @HttpCode(200)
  @SkipThrottle()
  refresh(@Body() body: RefreshDto): Promise<AuthResponse> {
    return this.auth.refresh(body.refreshToken);
  }

  @Post('sign-out')
  @HttpCode(204)
  @SkipThrottle()
  signOut(@Body() body: RefreshDto): Promise<void> {
    return this.auth.signOut(body.refreshToken);
  }
}
