import { LEAD_STAGES } from '@maqar/shared';
import { sql } from 'drizzle-orm';
import { bigint, boolean, index, mysqlEnum, mysqlTable, timestamp, unique, varchar } from 'drizzle-orm/mysql-core';
import { agents } from '../agents/agents.schema.js';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';

/**
 * A client in an agent's pipeline (contract §13). Booking a viewing creates the client's lead with
 * that agent or moves it on (contract §8.7). Leads from outside the app (a call, a walk-in) have
 * no account, so a name and phone instead.
 */
export const leads = mysqlTable(
  'leads',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    clientId: bigint('client_id', { mode: 'number', unsigned: true }).references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 100 }),
    phone: varchar('phone', { length: 20 }),
    /** The home they asked about last. */
    propertyId: bigint('property_id', { mode: 'number', unsigned: true }).references(() => properties.id, { onDelete: 'set null' }),
    agentId: bigint('agent_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => agents.userId),
    budget: bigint('budget', { mode: 'number', unsigned: true }),
    /** One of `LEAD_SOURCES`. */
    source: varchar('source', { length: 40 }).notNull().default('booking'),
    stage: mysqlEnum('stage', LEAD_STAGES).notNull().default('new'),
    hot: boolean('hot').notNull().default(false),
    fromApp: boolean('from_app').notNull().default(true),
    lastActivityAt: timestamp('last_activity_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
    // Milliseconds, like viewings.created_at, so a booking in the same second still counts as new.
    /** When the agent last opened the lead; a new booking clears it, so the booking shows as "New from app". */
    seenAt: timestamp('seen_at', { fsp: 3 }),
    /** When it moved to Won (cleared if it moves back): the monthly target counts these. */
    wonAt: timestamp('won_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('leads_client_agent_unique').on(t.clientId, t.agentId), index('leads_agent_idx').on(t.agentId, t.stage)],
);

export type LeadRow = typeof leads.$inferSelect;

/** The agent's notes on a lead (contract §10.2), newest first on the lead page. */
export const leadNotes = mysqlTable(
  'lead_notes',
  {
    id: bigint('id', { mode: 'number', unsigned: true }).autoincrement().primaryKey(),
    leadId: bigint('lead_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => leads.id, { onDelete: 'cascade' }),
    agentId: bigint('agent_id', { mode: 'number', unsigned: true })
      .notNull()
      .references(() => agents.userId),
    text: varchar('text', { length: 1000 }).notNull(),
    createdAt: timestamp('created_at', { fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index('lead_notes_lead_idx').on(t.leadId, t.createdAt)],
);
