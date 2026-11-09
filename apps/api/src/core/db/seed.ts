// `pnpm --filter @maqar/api db:seed`: adds the demo data to the database in the root .env.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/mysql2';
import { createPool } from 'mysql2/promise';
import { seedAreas } from '../../modules/areas/areas.seed.js';
import { seedProperties } from '../../modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../modules/users/users.seed.js';
import * as schema from './schema.js';

config({ path: '../../.env', quiet: true });

const { DATABASE_URL, SEED_PASSWORD, UPLOADS_DIR = 'uploads' } = process.env;
if (!DATABASE_URL || !SEED_PASSWORD) throw new Error('DATABASE_URL and SEED_PASSWORD must be set in the root .env');

// The demo photos become the seed listings' photos (uploads/seed, git-ignored).
const seedDir = path.resolve(UPLOADS_DIR, 'seed');
await mkdir(seedDir, { recursive: true });
await cp(path.resolve('../demo/public/img'), seedDir, { recursive: true });

const pool = createPool({ uri: DATABASE_URL });
const db = drizzle({ client: pool, schema, mode: 'default' });
await seedDemoAccounts(db, SEED_PASSWORD);
await seedAreas(db);
await seedProperties(db);
await pool.end();
console.log('Seeded: 4 agents, 1 admin, 1 client, 1 owner (password: SEED_PASSWORD in .env), 8 areas, 16 listings');
