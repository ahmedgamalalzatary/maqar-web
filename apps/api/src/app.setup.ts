import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './core/config/env.js';

/** Everything main.ts sets on the app. e2e tests call this too, so they test the real setup. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  const origins = config.get('CORS_ORIGINS', { infer: true });
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });

  app.setGlobalPrefix('v1', { exclude: ['docs', 'docs-json'] });

  // Unknown fields are refused, and input is converted to the DTO types.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  app.enableShutdownHooks();

  const doc = new DocumentBuilder()
    .setTitle('Maqar API')
    .setDescription('REST API for the Maqar mobile app. Errors use the standard NestJS shape.')
    .setVersion('1')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, () => SwaggerModule.createDocument(app, doc), { jsonDocumentUrl: 'docs-json' });
}
