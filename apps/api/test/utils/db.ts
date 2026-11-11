import { createConnection } from 'mysql2/promise';

/**
 * Empties every app table, so each test file starts from a clean database. The tables are read
 * from the schema, so a new migration's table cannot be forgotten; only Drizzle's own log stays.
 */
export async function resetDb(): Promise<void> {
  const conn = await createConnection({ uri: process.env.DATABASE_URL! });
  const [rows] = await conn.query(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE' AND TABLE_NAME <> '__drizzle_migrations'",
  );
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const { name } of rows as { name: string }[]) await conn.query(`TRUNCATE TABLE \`${name}\``);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
}
