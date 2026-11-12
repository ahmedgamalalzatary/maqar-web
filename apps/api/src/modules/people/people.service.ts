import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminAccount, AdminClientDetail, AdminClientItem, AdminClientsPage, ClientUpdateResult } from '@maqar/shared';
import { hashPassword } from '../auth/password.js';
import { UsersRepository } from '../users/users.repository.js';
import { UsersService } from '../users/users.service.js';
import { ViewingsService } from '../viewings/viewings.service.js';
import type { CreateAdminDto, ClientsQueryDto, UpdateAdminDto, UpdateClientDto } from './dto/people.dto.js';
import { type PersonRow, PeopleRepository } from './people.repository.js';

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function clientItem(r: PersonRow): AdminClientItem {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone,
    lang: r.lang,
    createdAt: r.createdAt.toISOString(),
    suspendedAt: iso(r.suspendedAt),
    lastSeenAt: iso(r.lastSeenAt),
    saved: r.saved,
    viewings: r.viewings,
    chats: r.chats,
    leads: r.leads,
  };
}

const accountOf = (r: PersonRow, me: number): AdminAccount => ({
  id: r.id,
  name: r.name,
  email: r.email ?? '',
  phone: r.phone,
  createdAt: r.createdAt.toISOString(),
  suspendedAt: iso(r.suspendedAt),
  lastSeenAt: iso(r.lastSeenAt),
  you: r.id === me,
});

/**
 * The admin's people pages (phase 22, contract §11): client accounts and admin accounts. A
 * suspended account is refused on every request at once (the access check skips it) and its
 * sessions are ended, so lifting the suspension needs a fresh sign-in.
 */
@Injectable()
export class PeopleService {
  constructor(
    private readonly repo: PeopleRepository,
    private readonly users: UsersRepository,
    private readonly profiles: UsersService,
    private readonly viewings: ViewingsService,
  ) {}

  async clients(q: ClientsQueryDto): Promise<AdminClientsPage> {
    const { rows, total, counts } = await this.repo.clients(q);
    return { items: rows.map(clientItem), page: q.page, limit: q.limit, total, counts };
  }

  async client(id: number): Promise<AdminClientDetail> {
    const row = await this.repo.person(id, 'client');
    if (!row) throw new NotFoundException('Client not found');
    const [prefs, recent, threads, leads] = await Promise.all([this.users.findPrefs(id), this.repo.recentViewings(id), this.repo.threads(id), this.repo.leads(id)]);
    return {
      ...clientItem(row),
      prefs: prefs ?? null,
      recentViewings: recent.map((v) => ({ ...v, startsAt: v.startsAt.toISOString() })),
      threads: threads.map((t) => ({ ...t, lastMessageAt: iso(t.lastMessageAt) })),
      leadsList: leads.map((l) => ({ ...l, lastActivityAt: l.lastActivityAt.toISOString() })),
    };
  }

  /** A new password (signs them out everywhere), or suspend / restore. */
  async updateClient(id: number, body: UpdateClientDto): Promise<ClientUpdateResult> {
    const cur = await this.repo.person(id, 'client');
    if (!cur) throw new NotFoundException('Client not found');
    let cancelledViewings = 0;
    if (body.password !== undefined) await this.repo.update(id, { passwordHash: await hashPassword(body.password) });
    if (body.suspended === true && !cur.suspendedAt) {
      // Before the suspension, while the client's name still reads for the advisors' notice.
      cancelledViewings = await this.viewings.cancelUpcomingOf(id);
      await this.repo.update(id, { suspendedAt: new Date() });
    } else if (body.suspended === false && cur.suspendedAt) {
      await this.repo.update(id, { suspendedAt: null });
    }
    if (body.password !== undefined || body.suspended === true) await this.repo.signOutEverywhere(id);
    return { ...(await this.client(id)), cancelledViewings };
  }

  /** Exactly what the client's own delete does (contract §8.14). */
  async removeClient(id: number): Promise<void> {
    if (!(await this.repo.person(id, 'client'))) throw new NotFoundException('Client not found');
    await this.profiles.removeClient(id);
    await this.repo.signOutEverywhere(id);
  }

  async admins(me: number): Promise<AdminAccount[]> {
    return (await this.repo.admins()).map((r) => accountOf(r, me));
  }

  async createAdmin(body: CreateAdminDto, me: number): Promise<AdminAccount> {
    if (await this.repo.emailInUse(body.email)) throw new ConflictException('That email already has an account');
    const id = await this.repo.create({ role: 'admin', name: body.name, email: body.email, phone: body.phone ?? null, passwordHash: await hashPassword(body.password) });
    return accountOf((await this.repo.person(id, 'admin'))!, me);
  }

  /** Profile, password and suspension. An admin cannot suspend themselves, so one always stays active. */
  async updateAdmin(id: number, body: UpdateAdminDto, me: number): Promise<AdminAccount> {
    const cur = await this.repo.person(id, 'admin');
    if (!cur) throw new NotFoundException('Admin not found');
    if (body.suspended === true && id === me) throw new ConflictException('You cannot suspend your own account');
    const emailChanged = body.email !== undefined && body.email !== cur.email;
    if (emailChanged && (await this.repo.emailInUse(body.email!, id))) throw new ConflictException('That email already has an account');
    await this.repo.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(emailChanged ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.password !== undefined ? { passwordHash: await hashPassword(body.password) } : {}),
      ...(body.suspended === true && !cur.suspendedAt ? { suspendedAt: new Date() } : {}),
      ...(body.suspended === false ? { suspendedAt: null } : {}),
    });
    if (body.password !== undefined || emailChanged || (body.suspended === true && !cur.suspendedAt)) await this.repo.signOutEverywhere(id);
    return accountOf((await this.repo.person(id, 'admin'))!, me);
  }
}
