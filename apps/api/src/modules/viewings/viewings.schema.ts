import { REMINDER_OFFSETS, VIEWING_CANCELLERS, VIEWING_MODES, VIEWING_STATUSES } from '@maqar/shared';
import { sql } from 'drizzle-orm';
import { bigint, datetime, index, mysqlEnum, mysqlTable, primaryKey, timestamp, tinyint, unique, varchar } from 'drizzle-orm/mysql-core';
import { agents } from '../agents/agents.schema.js';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';

/**
 * A booked viewing (contract §8.7, §13). `starts_at` is UTC. `active` is 1 while the viewing is
 * confirmed or rescheduled and NULL otherwise; MySQL lets many rows share NULL in a unique key, so
 * the key (agent, hour, active) lets an agent have only one live viewing per hour, and a cancelled
 * one frees the hour. The key (client, property, active) likewise keeps a client to one live
 * viewing per home — enforced by the database, so two simultaneous bookings cannot both commit.
 */
export const viewings = mysqlTable(
  'viewings',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    propertyId: bigint('property_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),
    clientId: bigint('client_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: bigint('agent_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => agents.userId),
    startsAt: datetime('starts_at').notNull(),
    /** In-person only for now (§16.1 #5); ⚑ `video` may come later. */
    mode: mysqlEnum('mode', VIEWING_MODES).notNull().default('visit'),
    status: mysqlEnum('status', VIEWING_STATUSES).notNull().default('confirmed'),
    rescheduledFrom: datetime('rescheduled_from'),
    /** Who cancelled it (phase 27's reports); viewings cancelled before then have none. */
    cancelledBy: mysqlEnum('cancelled_by', VIEWING_CANCELLERS),
    videoUrl: varchar('video_url', { length: 500 }),
    active: tinyint('active').generatedAlwaysAs(sql`(if(\`status\` in ('confirmed','rescheduled'), 1, NULL))`, { mode: 'stored' }),
    createdAt: timestamp('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    updatedAt: timestamp('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
      .onUpdateNow(),
  },
  (t) => [
    unique('viewings_agent_hour_unique').on(t.agentId, t.startsAt, t.active),
    unique('viewings_client_property_active_unique').on(t.clientId, t.propertyId, t.active),
    index('viewings_client_idx').on(t.clientId, t.startsAt),
  ],
);

export type ViewingRow = typeof viewings.$inferSelect;

/**
 * The reminders a client chose for a viewing (contract §8.7). The job claims each once (a lease:
 * it expires, so a crashed run's reminders are retried) and stamps `sent_at` only after delivery,
 * so a crash can never leave a reminder marked sent but never sent.
 */
export const viewingReminders = mysqlTable(
  'viewing_reminders',
  {
    viewingId: bigint('viewing_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => viewings.id, { onDelete: 'cascade' }),
    offset: mysqlEnum('offset', REMINDER_OFFSETS).notNull(),
    /** The lease: when the job took this reminder. Delivery stamps `sent_at` afterwards. */
    claimedAt: timestamp('claimed_at'),
    sentAt: timestamp('sent_at'),
  },
  (t) => [primaryKey({ columns: [t.viewingId, t.offset] })],
);
