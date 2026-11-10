import { rm } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Me, Prefs, UpdateMeBody } from '@maqar/shared';
import type { Env } from '../../core/config/env.js';
import { verifyPassword } from '../auth/password.js';
import type { AgentRow } from '../agents/agents.schema.js';
import { UsersRepository } from './users.repository.js';
import type { UserRow } from './users.schema.js';

export function toMe(user: UserRow, agent?: AgentRow, prefs?: Prefs | null): Me {
  return {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email ?? '',
    phone: user.phone,
    lang: user.lang,
    theme: user.theme,
    pushEnabled: user.pushEnabled,
    createdAt: user.createdAt.toISOString(),
    ...(user.role === 'client' && { prefs: prefs ?? null }),
    ...(agent && {
      agent: {
        nameAr: agent.nameAr,
        nameEn: agent.nameEn,
        roleTitleAr: agent.roleTitleAr,
        roleTitleEn: agent.roleTitleEn,
        rating: agent.rating,
        dealsCount: agent.dealsCount,
        years: agent.years,
        phone: agent.phone,
        colour: agent.colour,
      },
    }),
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly users: UsersRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async getMe(id: number): Promise<Me> {
    const user = await this.users.findActiveById(id);
    if (!user) throw new UnauthorizedException();
    const agent = user.role === 'agent' ? await this.users.findAgentProfile(id) : undefined;
    const prefs = user.role === 'client' ? await this.users.findPrefs(id) : undefined;
    return toMe(user, agent, prefs);
  }

  /** Saves a client's preferences whole (contract §8.1). Every area must exist. */
  async savePrefs(id: number, prefs: Prefs): Promise<Prefs> {
    if ((await this.users.countAreas(prefs.areas)) !== prefs.areas.length) {
      throw new BadRequestException('areas must all be known area ids');
    }
    await this.users.savePrefs(id, prefs);
    return prefs;
  }

  /** A client's saved preferences, or undefined before onboarding. */
  prefsFor(id: number): Promise<Prefs | undefined> {
    return this.users.findPrefs(id);
  }

  /** Only profile fields are written, whatever the request carries. An empty change is a no-op. */
  async updateMe(id: number, body: UpdateMeBody): Promise<Me> {
    const { name, phone, lang, theme, pushEnabled } = body;
    const changes = Object.fromEntries(
      Object.entries({ name, phone, lang, theme, pushEnabled }).filter(([, v]) => v !== undefined),
    );
    if (Object.keys(changes).length) await this.users.update(id, changes);
    return this.getMe(id);
  }

  /** Clients can delete their own account. Agents and admins are removed by an admin. */
  async deleteMe(id: number, password: string, onDeleted: () => Promise<void>): Promise<void> {
    const user = await this.users.findActiveById(id);
    if (!user) throw new UnauthorizedException();
    if (user.role === 'agent' || user.role === 'admin') {
      throw new ForbiddenException('Staff accounts are removed by an admin');
    }
    if (!(await verifyPassword(user.passwordHash, password))) throw new UnauthorizedException('Wrong password');
    const threads = await this.users.softDelete(id);
    // Their chat photos are served from the uploads folder; they go with the conversations.
    const uploads = path.resolve(this.config.get('UPLOADS_DIR', { infer: true }), 'chat');
    await Promise.all(threads.map((t) => rm(path.join(uploads, String(t)), { recursive: true, force: true })));
    await onDeleted();
  }
}
