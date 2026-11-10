import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from 'nestjs-pino';
import { type Env, validateEnv } from './core/config/env.js';
import { DbModule } from './core/db/db.module.js';
import { AreasModule } from './modules/areas/areas.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { ChatModule } from './modules/chat/chat.module.js';
import { FavoritesModule } from './modules/favorites/favorites.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { ListingsModule } from './modules/listings/listings.module.js';
import { LeadsModule } from './modules/leads/leads.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { PricesModule } from './modules/prices/prices.module.js';
import { PropertiesModule } from './modules/properties/properties.module.js';
import { UploadsModule } from './modules/uploads/uploads.module.js';
import { ViewingsModule } from './modules/viewings/viewings.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // The single .env lives at the repo root (contract §5). Tests get their
      // variables from the root .env.test through vitest instead.
      envFilePath: '../../.env',
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: validateEnv,
    }),
    // Read NODE_ENV from the validated config, after the root .env is loaded.
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        const env = config.get('NODE_ENV', { infer: true });
        return {
          pinoHttp: {
            level: env === 'test' ? 'silent' : env === 'production' ? 'info' : 'debug',
            // pino-pretty is a dev dependency, so only development uses it.
            transport: env === 'development' ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
            redact: ['req.headers.authorization', 'req.headers.cookie'],
          },
        };
      },
    }),
    // Timed jobs (viewing reminders). Off in tests, which run them by hand.
    ...(process.env.NODE_ENV === 'test' ? [] : [ScheduleModule.forRoot()]),
    DbModule,
    HealthModule,
    AuthModule,
    UsersModule,
    AreasModule,
    PropertiesModule,
    FavoritesModule,
    NotificationsModule,
    PricesModule,
    ViewingsModule,
    LeadsModule,
    ChatModule,
    UploadsModule,
    ListingsModule,
  ],
})
export class AppModule {}
