import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { SkipThrottle, ThrottlerGuard } from '@nestjs/throttler';
import type { AuthResponse } from '@maqar/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthService } from './auth.service.js';
import { ForgotPasswordDto, RefreshDto, ResetPasswordDto, SignInDto, SignUpDto } from './dto/auth.dto.js';

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

  /** Emails a code to set a new password (phase 31). Always 204: it never says whether the email has an account. */
  @Post('forgot-password')
  @HttpCode(204)
  forgotPassword(@Body() body: ForgotPasswordDto): Promise<void> {
    return this.auth.forgotPassword(body.email);
  }

  /** The emailed code and a new password: signs in, and every older session ends (phase 31). */
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() body: ResetPasswordDto): Promise<AuthResponse> {
    return this.auth.resetPassword(body);
  }

  @Post('sign-out')
  @HttpCode(204)
  @SkipThrottle()
  signOut(@Body() body: RefreshDto): Promise<void> {
    return this.auth.signOut(body.refreshToken);
  }
}
