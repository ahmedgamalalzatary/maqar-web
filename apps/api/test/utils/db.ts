import { createConnection } from 'mysql2/promise';

/** Empties every app table, so each test file starts from a clean database. */
export async function resetDb(): Promise<void> {
  const conn = await createConnection({ uri: process.env.DATABASE_URL! });
  await conn.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of ['viewing_reminders', 'viewings', 'lead_notes', 'leads', 'agent_hours', 'agent_days_off', 'price_alerts', 'price_history', 'notifications', 'push_tokens', 'favorites', 'client_prefs', 'tour_rooms', 'property_images', 'property_features', 'properties', 'areas', 'refresh_tokens', 'agents', 'users']) await conn.query(`TRUNCATE TABLE \`${t}\``);
  await conn.query('SET FOREIGN_KEY_CHECKS = 1');
  await conn.end();
}
