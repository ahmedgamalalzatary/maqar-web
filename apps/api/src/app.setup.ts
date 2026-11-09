import path from 'node:path';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { Env } from './core/config/env.js';

/** Everything main.ts sets on the app. e2e tests call this too, so they test the real setup. */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<Env, true>);

  app.use(helmet());
  // Behind nginx every request comes from nginx; take the client's address from what it reports.
  const hops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (hops > 0) (app as NestExpressApplication).set('trust proxy', hops);
  // The phone app needs no CORS. Browsers get the listed origins; with none listed,
  // any origin is allowed in development only, and none in production.
  const origins = config.get('CORS_ORIGINS', { infer: true });
  const dev = config.get('NODE_ENV', { infer: true }) !== 'production';
  app.enableCors({ origin: origins.length ? origins : dev, credentials: true });

  app.setGlobalPrefix('v1', { exclude: ['docs', 'docs-json'] });

  // Photos live under /uploads. In production nginx serves that folder itself (contract §16.1 #2).
  if (dev) {
    (app as NestExpressApplication).useStaticAssets(path.resolve(config.get('UPLOADS_DIR', { infer: true })), {
      prefix: '/uploads/',
      maxAge: '7d',
      // Photos are public; helmet's same-origin policy would block them in a web preview.
      setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
    });
  }

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
