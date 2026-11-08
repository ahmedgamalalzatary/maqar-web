import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './core/config/env.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  configureApp(app);
  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true });
  // 0.0.0.0 so a phone on the same Wi-Fi can reach the dev API.
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
