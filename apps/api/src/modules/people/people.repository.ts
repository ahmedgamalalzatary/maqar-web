import { Injectable } from '@nestjs/common';
import type { AdminAgent, AdminHomeRef, ClientStatus, LeadStage, ViewingStatus } from '@maqar/shared';
import { and, count, desc, eq, isNotNull, isNull, like, or, type SQL, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../../core/db/db.module.js';
import { agents } from '../agents/agents.schema.js';
import { refreshTokens } from '../auth/auth.schema.js';
import { chatMessages, chatThreads } from '../chat/chat.schema.js';
import { favorites } from '../favorites/favorites.schema.js';
import { leads } from '../leads/leads.schema.js';
import { properties } from '../properties/properties.schema.js';
import { type NewUserRow, type UserRow, users } from '../users/users.schema.js';
import { viewings } from '../viewings/viewings.schema.js';

/** A client or admin row with what the admin lists show next to it. */
export type PersonRow = UserRow & { lastSeenAt: Date | null; saved: number; viewings: number; chats: number; leads: number };

// Correlated counts name the outer column with its table: on one table Drizzle leaves names bare.
const USER_ID = sql.raw('`users`.`id`');
const countOf = (table: SQL) => sql<number>`(${table})`;

const agentRef = { id: agents.userId, nameAr: agents.nameAr, nameEn: agents.nameEn, colour: agents.colour };
const homeRef = { id: properties.id, titleAr: properties.titleAr, titleEn: properties.titleEn };

/** Database access for the admin's people pages (phase 22): clients and admin accounts. */
@Injectable()
export class PeopleRepository {
  constructor(@InjectDb() private readonly db: Db) {}

  private columns() {
    return {
      user: users,
      // Epoch milliseconds: a raw max() comes back as zone-less text, which would be read as local time.
      lastSeenAt: sql<number | string | null>`(select unix_timestamp(max(${refreshTokens.createdAt})) * 1000 from ${refreshTokens} where ${refreshTokens.userId} = ${USER_ID})`,
      saved: countOf(sql`select count(*) from ${favorites} where ${favorites.userId} = ${USER_ID}`),
      viewings: countOf(sql`select count(*) from ${viewings} where ${viewings.clientId} = ${USER_ID}`),
      chats: countOf(sql`select count(*) from ${chatThreads} where ${chatThreads.clientId} = ${USER_ID}`),
      leads: countOf(sql`select count(*) from ${leads} where ${leads.clientId} = ${USER_ID}`),
    };
  }

  private toRow(r: { user: UserRow; lastSeenAt: number | string | null; saved: number; viewings: number; chats: number; leads: number }): PersonRow {
    return {
      ...r.user,
      lastSeenAt: r.lastSeenAt == null ? null : new Date(Number(r.lastSeenAt)),
      saved: Number(r.saved),
      viewings: Number(r.viewings),
      chats: Number(r.chats),
      leads: Number(r.leads),
    };
  }

  /** Clients newest first, by status and by words in the name, email or phone. */
  async clients(q: { q?: string; status?: ClientStatus; page: number; limit: number }): Promise<{ rows: PersonRow[]; total: number; counts: Record<ClientStatus, number> }> {
    const base = and(eq(users.role, 'client'), isNull(users.deletedAt));
    const words = q.q ? `%${q.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%` : undefined;
    const where = and(
      base,
      q.status === 'suspended' ? isNotNull(users.suspendedAt) : q.status === 'active' ? isNull(users.suspendedAt) : undefined,
      words ? or(like(users.name, words), like(users.email, words), like(users.phone, words)) : undefined,
    );
    const [rows, [{ total }], byStatus] = await Promise.all([
      this.db
        .select(this.columns())
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt), desc(users.id))
        .limit(q.limit)
        .offset((q.page - 1) * q.limit),
      this.db.select({ total: count() }).from(users).where(where),
      this.db
        .select({ suspended: sql<number>`${users.suspendedAt} is not null`, n: count() })
        .from(users)
        .where(base)
        .groupBy(sql`${users.suspendedAt} is not null`),
    ]);
    const counts: Record<ClientStatus, number> = { active: 0, suspended: 0 };
    for (const r of byStatus) counts[Number(r.suspended) ? 'suspended' : 'active'] = Number(r.n);
    return { rows: rows.map((r) => this.toRow(r)), total: Number(total), counts };
  }

  /** One not-deleted account of this role, with its counts. */
  async person(id: number, role: 'client' | 'admin'): Promise<PersonRow | undefined> {
    const [row] = await this.db
      .select(this.columns())
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, role), isNull(users.deletedAt)));
    return row && this.toRow(row);
  }

  async admins(): Promise<PersonRow[]> {
    const rows = await this.db
      .select(this.columns())
      .from(users)
      .where(and(eq(users.role, 'admin'), isNull(users.deletedAt)))
      .orderBy(users.createdAt, users.id);
    return rows.map((r) => this.toRow(r));
  }

  /** The client's latest viewings, newest time first. */
  async recentViewings(clientId: number, limit = 10): Promise<{ id: number; startsAt: Date; status: ViewingStatus; property: AdminHomeRef; agent: AdminAgent }[]> {
    return this.db
      .select({ id: viewings.id, startsAt: viewings.startsAt, status: viewings.status, property: homeRef, agent: agentRef })
      .from(viewings)
      .innerJoin(properties, eq(properties.id, viewings.propertyId))
      .innerJoin(agents, eq(agents.userId, viewings.agentId))
      .where(eq(viewings.clientId, clientId))
      .orderBy(desc(viewings.startsAt), desc(viewings.id))
      .limit(limit);
  }

  async threads(clientId: number): Promise<{ id: number; property: AdminHomeRef; agent: AdminAgent; lastMessageAt: Date | null; messages: number }[]> {
    const messages = sql<number>`(select count(*) from ${chatMessages} where ${chatMessages.threadId} = ${sql.raw('`chat_threads`.`id`')})`;
    const rows = await this.db
      .select({ id: chatThreads.id, property: homeRef, agent: agentRef, lastMessageAt: chatThreads.lastMessageAt, messages })
      .from(chatThreads)
      .innerJoin(properties, eq(properties.id, chatThreads.propertyId))
      .innerJoin(agents, eq(agents.userId, chatThreads.agentId))
      .where(eq(chatThreads.clientId, clientId))
      .orderBy(desc(chatThreads.lastMessageAt), desc(chatThreads.id));
    return rows.map((r) => ({ ...r, messages: Number(r.messages) }));
  }

  async leads(clientId: number): Promise<{ id: number; stage: LeadStage; property: AdminHomeRef | null; agent: AdminAgent; lastActivityAt: Date }[]> {
    const rows = await this.db
      .select({ id: leads.id, stage: leads.stage, pid: properties.id, titleAr: properties.titleAr, titleEn: properties.titleEn, agent: agentRef, lastActivityAt: leads.lastActivityAt })
      .from(leads)
      .leftJoin(properties, eq(properties.id, leads.propertyId))
      .innerJoin(agents, eq(agents.userId, leads.agentId))
      .where(eq(leads.clientId, clientId))
      .orderBy(desc(leads.lastActivityAt));
    return rows.map(({ pid, titleAr, titleEn, ...r }) => ({ ...r, property: pid ? { id: pid, titleAr: titleAr!, titleEn: titleEn! } : null }));
  }

  async emailInUse(email: string, exceptId?: number): Promise<boolean> {
    const [row] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return row !== undefined && row.id !== exceptId;
  }

  async create(data: NewUserRow): Promise<number> {
    const [{ id }] = await this.db.insert(users).values(data).$returningId();
    return id;
  }

  async update(id: number, data: Partial<NewUserRow>): Promise<void> {
    if (Object.keys(data).length) await this.db.update(users).set(data).where(eq(users.id, id));
  }

  /** Ends every session: refresh tokens are revoked and access tokens issued so far stop working. */
  async signOutEverywhere(id: number): Promise<void> {
    await this.db.update(refreshTokens).set({ revokedAt: new Date() }).where(and(eq(refreshTokens.userId, id), isNull(refreshTokens.revokedAt)));
    await this.db.update(users).set({ credentialsChangedAt: new Date() }).where(eq(users.id, id));
  }
}
