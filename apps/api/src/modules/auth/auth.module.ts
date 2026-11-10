import { forwardRef, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import type { Env } from '../../core/config/env.js';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthRepository } from './auth.repository.js';
import { AuthService } from './auth.service.js';
import { AccessTokenGuard } from './guards/access-token.guard.js';
import { TokenUsers } from './token-users.js';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        secret: config.get('JWT_ACCESS_SECRET', { infer: true }),
        signOptions: { expiresIn: config.get('JWT_ACCESS_TTL', { infer: true }) as `${number}m` },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => [
        { ttl: 60_000, limit: config.get('AUTH_RATE_LIMIT', { infer: true }) },
      ],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthRepository,
    TokenUsers,
    // Order matters: who you are first, then what your role may do.
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [AuthRepository, TokenUsers],
})
export class AuthModule {}
