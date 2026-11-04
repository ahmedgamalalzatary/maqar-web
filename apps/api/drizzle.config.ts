import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// The single .env lives at the repo root.
config({ path: '../../.env', quiet: true });

export default defineConfig({
  dialect: 'mysql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
