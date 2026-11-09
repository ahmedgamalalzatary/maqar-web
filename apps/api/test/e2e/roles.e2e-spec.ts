import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Role } from '@maqar/shared';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { Roles } from '../../src/common/decorators/roles.decorator.js';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { agents } from '../../src/modules/agents/agents.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { bearer } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// One route per role, behind the real global guards.
@Controller('probe')
class ProbeController {
  @Roles('client') @Get('client') client() { return 'ok'; }
  @Roles('agent') @Get('agent') agent() { return 'ok'; }
  @Roles('admin') @Get('admin') admin() { return 'ok'; }
}

describe('Role guards (e2e)', () => {
  let app: INestApplication<App>;
  const tokens = {} as Record<Role, string>;

  beforeAll(async () => {
    await resetDb();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule], controllers: [ProbeController] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();

    // The seed creates one account per role; running it twice must not duplicate them.
    await seedDemoAccounts(app.get<Db>(DB), process.env.SEED_PASSWORD!);
    await seedDemoAccounts(app.get<Db>(DB), process.env.SEED_PASSWORD!);

    for (const [role, email] of Object.entries({
      client: 'client@maqar.app',
      agent: 'omar@maqar.app',
      admin: 'admin@maqar.app',
    })) {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/sign-in')
        .send({ email, password: process.env.SEED_PASSWORD })
        .expect(200);
      expect(res.body.user.role).toBe(role);
      tokens[role as Role] = res.body.accessToken;
    }
  });
  afterAll(async () => {
    await app.close();
  });

  const roles: Role[] = ['client', 'agent', 'admin'];

  it.each(roles)('a %s reaches only their own role routes', async (role) => {
    for (const route of roles) {
      await request(app.getHttpServer())
        .get(`/v1/probe/${route}`)
        .set(bearer(tokens[role]))
        .expect(route === role ? 200 : 403);
    }
  });

  it('the seed created the 4 demo agents with their profiles', async () => {
    const res = await request(app.getHttpServer()).get('/v1/me').set(bearer(tokens.agent)).expect(200);
    expect(res.body.agent).toMatchObject({ nameEn: 'Omar Hassan', roleTitleEn: 'Senior sales advisor' });
    expect(await app.get<Db>(DB).$count(agents)).toBe(4);
  });
});
