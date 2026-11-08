import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { createConnection } from 'mysql2/promise';

/** Applies the SQL migrations in ./drizzle. Used by e2e setup; `pnpm db:migrate` uses drizzle-kit. */
export async function runMigrations(url: string, migrationsFolder = './drizzle'): Promise<void> {
  const conn = await createConnection({ uri: url, multipleStatements: true });
  try {
    await migrate(drizzle({ client: conn }), { migrationsFolder });
  } finally {
    await conn.end();
  }
}
