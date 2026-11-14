import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/mysql2';
import { type Db, utcPool } from '../../src/core/db/db.module.js';
import * as schema from '../../src/core/db/schema.js';
import { AgentsRepository, AgentStateError } from '../../src/modules/agents/agents.repository.js';
import { agents } from '../../src/modules/agents/agents.schema.js';
import { seedAreas } from '../../src/modules/areas/areas.seed.js';
import { refreshTokens } from '../../src/modules/auth/auth.schema.js';
import { properties } from '../../src/modules/properties/properties.schema.js';
import { seedProperties } from '../../src/modules/properties/properties.seed.js';
import { users } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { resetDb } from '../utils/db.js';

const profile = (userId: number, active = true) => ({
  userId,
  nameAr: 'مستشار',
  nameEn: 'Advisor',
  roleTitleAr: 'مستشار مبيعات',
  roleTitleEn: 'Sales advisor',
  languagesAr: 'العربية',
  languagesEn: 'Arabic',
  phone: `+2010000009${userId}`,
  colour: '#61766d',
  active,
});

/**
 * Giving listings in the agent form (phase 29) against real MySQL, because what matters is the
 * transaction and the row lock: a hand-off that fails must not leave half an edit behind, and
 * turning an agent off cannot interleave with giving them listings.
 */
describe('AgentsRepository: listings from the agent form (real database)', () => {
  let db: Db;
  let end: () => Promise<void>;
  let repo: AgentsRepository;
  let approvedId: number;
  const ON = 90; // an active agent with no listings
  const OFF = 91; // a turned-off agent

  beforeAll(async () => {
    const pool = utcPool(process.env.DATABASE_URL!);
    db = drizzle({ client: pool, schema, mode: 'default' });
    end = () => pool.end();
    repo = new AgentsRepository(db);
  });

  beforeEach(async () => {
    await resetDb();
    await seedDemoAccounts(db, 'Seed-Password-1');
    await seedAreas(db);
    await seedProperties(db);
    await db.insert(users).values([
      { id: ON, role: 'agent', name: 'مستشار', email: 'on@x.co', passwordHash: 'old-hash', phone: '+201000000990' },
      { id: OFF, role: 'agent', name: 'مستشار', email: 'off@x.co', passwordHash: 'old-hash', phone: '+201000000991' },
    ]);
    await db.insert(agents).values([profile(ON), profile(OFF, false)]);
    const [p] = await db.select({ id: properties.id }).from(properties).where(eq(properties.status, 'approved')).limit(1);
    approvedId = p!.id;
  });

  afterAll(async () => {
    await end();
  });

  const advisorOf = async (id: number) => (await db.select({ agentId: properties.agentId }).from(properties).where(eq(properties.id, id)))[0]!.agentId;
  const account = async (id: number) => (await db.select().from(users).where(eq(users.id, id)))[0]!;

  it('creates the account and gives it the picked listings in one call', async () => {
    const { userId: _unused, ...fresh } = profile(92);
    const id = await repo.create({ role: 'agent', name: 'جديد', email: 'new@x.co', phone: '+201000000992', passwordHash: 'h' }, fresh, [approvedId]);
    expect(await advisorOf(approvedId)).toBe(id);
  });

  it('gives listings, ends the sessions and invalidates old tokens in the same edit', async () => {
    await db.insert(refreshTokens).values({ userId: ON, tokenHash: 'a'.repeat(64), expiresAt: new Date(Date.now() + 86_400_000) });
    await repo.update(ON, { passwordHash: 'new-hash' }, {}, { listingIds: [approvedId], endSessions: true, touchCredentials: true });
    expect(await advisorOf(approvedId)).toBe(ON);
    const [token] = await db.select().from(refreshTokens).where(eq(refreshTokens.userId, ON));
    expect(token!.revokedAt).not.toBeNull();
    const after = await account(ON);
    expect(after.passwordHash).toBe('new-hash');
    expect(after.credentialsChangedAt).not.toBeNull();
  });

  it('refuses listings for a turned-off agent and keeps the rest of that edit out too', async () => {
    const before = await advisorOf(approvedId);
    await expect(repo.update(OFF, { passwordHash: 'new-hash' }, {}, { listingIds: [approvedId], touchCredentials: true })).rejects.toEqual(new AgentStateError('inactive'));
    expect(await advisorOf(approvedId)).toBe(before);
    expect((await account(OFF)).passwordHash).toBe('old-hash');
  });

  it('refuses listings and turning off in the same edit', async () => {
    await expect(repo.update(ON, {}, { active: false }, { listingIds: [approvedId] })).rejects.toEqual(new AgentStateError('inactive'));
    expect((await db.select({ active: agents.active }).from(agents).where(eq(agents.userId, ON)))[0]!.active).toBe(true);
  });

  it('refuses turning off an agent who got a live listing after the service last looked', async () => {
    // The service saw no live listings; meanwhile another edit gave this agent one.
    await db.update(properties).set({ agentId: ON }).where(eq(properties.id, approvedId));
    await expect(repo.update(ON, {}, { active: false }, { endSessions: true })).rejects.toEqual(new AgentStateError('live'));
    expect((await db.select({ active: agents.active }).from(agents).where(eq(agents.userId, ON)))[0]!.active).toBe(true);
  });
});
