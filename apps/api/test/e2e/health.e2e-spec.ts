import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp } from '../utils/app.js';

describe('Foundation (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('GET /v1/health reports the API and the database as up', async () => {
    const res = await request(app.getHttpServer()).get('/v1/health').expect(200);
    expect(res.body).toMatchObject({ status: 'ok', db: 'up' });
  });

  it('answers unknown routes with the standard error shape', async () => {
    const res = await request(app.getHttpServer()).get('/v1/nope').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });
});
