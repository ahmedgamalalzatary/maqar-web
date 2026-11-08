// `pnpm --filter @maqar/api db:seed`: adds the demo accounts to the database in the root .env.
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import { seedDemoAccounts } from '../../modules/users/users.seed.js';
import * as schema from './schema.js';

config({ path: '../../.env', quiet: true });

const { DATABASE_URL, SEED_PASSWORD } = process.env;
if (!DATABASE_URL || !SEED_PASSWORD) throw new Error('DATABASE_URL and SEED_PASSWORD must be set in the root .env');

const pool = createPool({ uri: DATABASE_URL });
await seedDemoAccounts(drizzle({ client: pool, schema, mode: 'default' }), SEED_PASSWORD);
await pool.end();
console.log('Seeded: 4 agents, 1 admin, 1 client, 1 owner (password: SEED_PASSWORD in .env)');
