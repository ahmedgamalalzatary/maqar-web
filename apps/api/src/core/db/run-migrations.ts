// `node dist/core/db/run-migrations.js`: applies the migrations in production, where drizzle-kit is not installed.
import { runMigrations } from './migrate.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL must be set');
await runMigrations(url);
console.log('Migrations applied');
