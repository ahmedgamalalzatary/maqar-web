import type { INestApplication } from '@nestjs/common';
import type { AuthResponse, SignUpBody } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';

let n = 0;

/** Signs up a new account and returns the auth response. Emails are unique per call. */
export async function signUp(app: INestApplication<App>, body: Partial<SignUpBody> = {}): Promise<AuthResponse> {
  n += 1;
  const res = await request(app.getHttpServer())
    .post('/v1/auth/sign-up')
    .send({ name: 'Test User', email: `user${n}-${Date.now()}@test.maqar`, password: 'Secret123', role: 'client', ...body })
    .expect(201);
  return res.body as AuthResponse;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Signs in a seeded account (the seed's SEED_PASSWORD) and returns its access token. */
export async function signInSeeded(app: INestApplication<App>, email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/sign-in')
    .send({ email, password: process.env.SEED_PASSWORD })
    .expect(200);
  return (res.body as AuthResponse).accessToken;
}
