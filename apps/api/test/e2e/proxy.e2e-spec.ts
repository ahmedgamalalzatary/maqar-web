import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { resetDb } from '../utils/db.js';

// Production runs behind nginx, so the API sees nginx's address on every request. The sign-in
// limit is per client (contract §14), so it must read the client's address from nginx, and must
// not believe that header when no proxy is there to set it.
describe('Client address behind a proxy (e2e)', () => {
  let app: INestApplication<App>;

  /** A fresh app with these settings: the env is read when the app module loads. */
  async function start(hops: string | undefined) {
    if (hops === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = hops;
    process.env.AUTH_RATE_LIMIT = '2';
    vi.resetModules();
    const { createTestApp } = await import('../utils/app.js');
    app = await createTestApp();
  }

  const signIn = (forwardedFor: string) =>
    request(app.getHttpServer())
      .post('/v1/auth/sign-in')
      .set('X-Forwarded-For', forwardedFor)
      .send({ email: 'nobody@test.maqar', password: 'Secret123' });

  const limit = process.env.AUTH_RATE_LIMIT;

  beforeAll(async () => {
    await resetDb();
  });
  afterAll(() => {
    process.env.AUTH_RATE_LIMIT = limit;
  });
  afterEach(async () => {
    await app.close();
    delete process.env.TRUST_PROXY_HOPS;
  });

  it('behind one proxy, each client has its own sign-in limit', async () => {
    await start('1');
    await signIn('203.0.113.1').expect(401);
    await signIn('203.0.113.1').expect(401);
    await signIn('203.0.113.1').expect(429);
    // Someone else is not locked out by that.
    await signIn('203.0.113.2').expect(401);
  });

  it('behind one proxy, an address the client adds itself does not help', async () => {
    await start('1');
    // nginx appends the real address, so only the last one counts.
    await signIn('198.51.100.1, 203.0.113.9').expect(401);
    await signIn('198.51.100.2, 203.0.113.9').expect(401);
    await signIn('198.51.100.3, 203.0.113.9').expect(429);
  });

  it('with no proxy, the header is ignored, so it cannot dodge the limit', async () => {
    await start(undefined);
    await signIn('203.0.113.1').expect(401);
    await signIn('203.0.113.2').expect(401);
    await signIn('203.0.113.3').expect(429);
  });
});
