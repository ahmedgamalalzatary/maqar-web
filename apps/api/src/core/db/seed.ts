// `pnpm --filter @maqar/api db:seed`: adds the demo data to the database in the root .env.
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/mysql2';
import { seedAreas } from '../../modules/areas/areas.seed.js';
import { seedSampleLeads } from '../../modules/leads/leads.seed.js';
import { seedProperties } from '../../modules/properties/properties.seed.js';
import { seedDemoAccounts } from '../../modules/users/users.seed.js';
import { utcPool } from './db.module.js';
import * as schema from './schema.js';

config({ path: '../../.env', quiet: true });

const { DATABASE_URL, SEED_PASSWORD } = process.env;
// Same default as the API's env check, also when .env leaves it empty.
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';
if (!DATABASE_URL || !SEED_PASSWORD) throw new Error('DATABASE_URL and SEED_PASSWORD must be set in the root .env');

// The demo photos become the seed listings' photos (uploads/seed, git-ignored).
const seedDir = path.resolve(UPLOADS_DIR, 'seed');
await mkdir(seedDir, { recursive: true });
await cp(path.resolve('../demo/public/img'), seedDir, { recursive: true });
// And the demo's panoramas become the 360° tours' rooms (uploads/seed/pano).
await cp(path.resolve('../demo/public/pano'), path.join(seedDir, 'pano'), { recursive: true });

const pool = utcPool(DATABASE_URL);
const db = drizzle({ client: pool, schema, mode: 'default' });
await seedDemoAccounts(db, SEED_PASSWORD);
await seedAreas(db);
await seedProperties(db);
await seedSampleLeads(db);
await pool.end();
console.log('Seeded: 4 agents, 1 admin, 1 client (password: SEED_PASSWORD in .env), 8 areas, 16 listings, sample leads');
