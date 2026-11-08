import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Only the rules that protect accounts are tested here.
describe('Accounts and sign-in (e2e)', () => {
  let app: INestApplication<App>;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('nobody can sign up as an agent or admin', async () => {
    await http()
      .post('/v1/auth/sign-up')
      .send({ name: 'X', email: 'x@test.maqar', password: 'Secret123', role: 'admin' })
      .expect(400);
  });

  it('a wrong password and an unknown email get the same 401', async () => {
    await signUp(app, { email: 'omar@test.maqar' });
    const wrong = await http().post('/v1/auth/sign-in').send({ email: 'omar@test.maqar', password: 'Wrong1234' }).expect(401);
    const unknown = await http().post('/v1/auth/sign-in').send({ email: 'nobody@test.maqar', password: 'Wrong1234' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
    await http().post('/v1/auth/sign-in').send({ email: 'Omar@test.maqar', password: 'Secret123' }).expect(200);
  });

  it('refresh rotates the token; replaying an old one signs out every session', async () => {
    const { refreshToken: first } = await signUp(app);
    const res = await http().post('/v1/auth/refresh').send({ refreshToken: first }).expect(200);
    await http().get('/v1/me').set(bearer(res.body.accessToken)).expect(200);

    await http().post('/v1/auth/refresh').send({ refreshToken: first }).expect(401); // stolen token replayed
    await http().post('/v1/auth/refresh').send({ refreshToken: res.body.refreshToken }).expect(401); // live one revoked too
  });

  it('/me needs a valid access token', async () => {
    await http().get('/v1/me').expect(401);
    await http().get('/v1/me').set(bearer('not-a-token')).expect(401);
  });

  it('deleting the account needs the password, then cuts all access and frees the email', async () => {
    const { accessToken, refreshToken } = await signUp(app, { email: 'leaving@test.maqar' });
    await http().delete('/v1/me').set(bearer(accessToken)).send({ password: 'Wrong1234' }).expect(401);
    await http().delete('/v1/me').set(bearer(accessToken)).send({ password: 'Secret123' }).expect(204);

    await http().get('/v1/me').set(bearer(accessToken)).expect(401);
    await http().post('/v1/auth/refresh').send({ refreshToken }).expect(401);
    await signUp(app, { email: 'leaving@test.maqar' });
  });
});
