import type { INestApplication } from '@nestjs/common';
import type { Page, PropertyCard } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { WRITE_LIMIT } from '../../src/common/rate-limit.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Contract §15: abuse-prone writes are limited per account in the API (nginx limits per address).
// Many clients share one address (a mobile carrier's NAT, an office's Wi-Fi), so one busy account
// must not use up everyone else's writes.
describe('Write rate limit (e2e)', () => {
  let app: INestApplication<App>;
  let homeId: number;
  const http = () => request(app.getHttpServer());
  const save = (token: string) => http().put(`/v1/favorites/${homeId}`).set(bearer(token));

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    const db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
    await seedAreas(db);
    await seedProperties(db);
    homeId = ((await http().get('/v1/properties?limit=1').expect(200)).body as Page<PropertyCard>).items[0]!.id;
  });
  afterAll(async () => {
    await app.close();
  });

  it('counts each account on its own, even from the same address', async () => {
    const busy = (await signUp(app)).accessToken;
    const other = (await signUp(app)).accessToken;
    for (let i = 0; i < WRITE_LIMIT.default.limit; i++) await save(busy).expect(204);
    await save(busy).expect(429);
    await save(other).expect(204);
  });
});
