import { drizzle } from 'drizzle-orm/mysql2';
import { type Db, utcPool } from '../../src/core/db/db.module.js';
import * as schema from '../../src/core/db/schema.js';
import { AgentsRepository } from '../../src/modules/agents/agents.repository.js';
import { agents } from '../../src/modules/agents/agents.schema.js';
import { leads } from '../../src/modules/leads/leads.schema.js';
import { users } from '../../src/modules/users/users.schema.js';
import { resetDb } from '../utils/db.js';

/** A Drizzle database on the test database, without the Nest app. */
async function createTestDb(): Promise<{ db: Db; end(): Promise<void> }> {
  const pool = utcPool(process.env.DATABASE_URL!);
  return { db: drizzle({ client: pool, schema, mode: 'default' }), end: () => pool.end() };
}

/**
 * The reassignment runs against real MySQL, because the failure mode (error 1093: the UPDATE reads
 * its own table in a subquery) only appears there; a mocked repository hides it.
 */
describe('AgentsRepository.reassign (real database)', () => {
  let db: Db;
  let end: () => Promise<void>;
  let repo: AgentsRepository;

  beforeAll(async () => {
    ({ db, end } = await createTestDb());
    repo = new AgentsRepository(db);
  });

  beforeEach(async () => {
    await resetDb();
    await db.insert(users).values([
      { id: 3, role: 'agent', name: 'عمر حسن', email: 'from@x.co', passwordHash: 'x', phone: '+201000000003' },
      { id: 4, role: 'agent', name: 'سلمى فؤاد', email: 'to@x.co', passwordHash: 'x', phone: '+201000000004' },
      { id: 10, role: 'client', name: 'ولاء' },
      { id: 11, role: 'client', name: 'كريم' },
    ]);
    await db.insert(agents).values(
      [3, 4].map((userId) => ({
        userId,
        nameAr: 'مستشار',
        nameEn: 'Advisor',
        roleTitleAr: 'مستشار مبيعات',
        roleTitleEn: 'Sales advisor',
        languagesAr: 'العربية',
        languagesEn: 'Arabic',
        phone: `+20100000000${userId}`,
        colour: '#61766d',
      })),
    );
    // L1: open lead for client 10 with the old advisor — moves.
    // L2: open lead for client 11 with the old advisor — stays: client 11 already has a lead with the new one.
    // L3: client 11's lead with the new advisor — the collision.
    // L4: client 12… (no account) lead already won — closed leads stay.
    await db.insert(leads).values([
      { clientId: 10, agentId: 3, name: 'ولاء', stage: 'new' },
      { clientId: 11, agentId: 3, name: 'كريم', stage: 'contacted' },
      { clientId: 11, agentId: 4, name: 'كريم', stage: 'new' },
      { agentId: 3, name: 'زائر', stage: 'won', wonAt: new Date() },
    ]);
  });

  afterAll(async () => {
    await end();
  });

  it('moves open leads, skips the ones that would collide, and reports the counts', async () => {
    const result = await repo.reassign(3, 4);
    expect(result.leads).toBe(1);
    const rows = await db.select({ clientId: leads.clientId, agentId: leads.agentId, stage: leads.stage }).from(leads);
    expect(rows).toContainEqual({ clientId: 10, agentId: 4, stage: 'new' });
    expect(rows).toContainEqual({ clientId: 11, agentId: 3, stage: 'contacted' });
    expect(rows).toContainEqual({ clientId: 11, agentId: 4, stage: 'new' });
    expect(rows.find((r) => r.stage === 'won')?.agentId).toBe(3);
  });

  it('moves nothing when there is nothing to move, without an SQL error', async () => {
    await resetDb();
    await db.insert(users).values({ id: 3, role: 'agent', name: 'عمر حسن', email: 'from@x.co', passwordHash: 'x', phone: '+201000000003' });
    await db.insert(users).values({ id: 4, role: 'agent', name: 'سلمى فؤاد', email: 'to@x.co', passwordHash: 'x', phone: '+201000000004' });
    await db.insert(agents).values(
      [3, 4].map((userId) => ({
        userId,
        nameAr: 'مستشار',
        nameEn: 'Advisor',
        roleTitleAr: 'مستشار مبيعات',
        roleTitleEn: 'Sales advisor',
        languagesAr: 'العربية',
        languagesEn: 'Arabic',
        phone: `+20100000000${userId}`,
        colour: '#61766d',
      })),
    );
    await expect(repo.reassign(3, 4)).resolves.toEqual({ viewings: 0, threads: 0, leads: 0 });
  });
});
