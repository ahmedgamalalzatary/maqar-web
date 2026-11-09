import { LEAD_STAGES } from '@maqar/shared';
import { bigint, boolean, index, mysqlEnum, mysqlTable, timestamp, unique, varchar } from 'drizzle-orm/mysql-core';
import { agents } from '../agents/agents.schema.js';
import { properties } from '../properties/properties.schema.js';
import { users } from '../users/users.schema.js';

/**
 * A client in an agent's pipeline (contract §13). Booking a viewing creates the client's lead with
 * that agent or moves it on (contract §8.7). Leads from outside the app (a call, a walk-in) have
 * no account, so a name and phone instead; the agent screens for them come in a later phase.
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
    source: varchar('source', { length: 40 }).notNull().default('app'),
    stage: mysqlEnum('stage', LEAD_STAGES).notNull().default('new'),
    hot: boolean('hot').notNull().default(false),
    fromApp: boolean('from_app').notNull().default(true),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [unique('leads_client_agent_unique').on(t.clientId, t.agentId), index('leads_agent_idx').on(t.agentId, t.stage)],
);
