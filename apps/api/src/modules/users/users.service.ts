import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Me, UpdateMeBody } from '@maqar/shared';
import { verifyPassword } from '../auth/password.js';
import type { AgentRow } from '../agents/agents.schema.js';
import { UsersRepository } from './users.repository.js';
import type { UserRow } from './users.schema.js';

export function toMe(user: UserRow, agent?: AgentRow): Me {
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
  constructor(private readonly users: UsersRepository) {}

  async getMe(id: number): Promise<Me> {
    const user = await this.users.findActiveById(id);
    if (!user) throw new UnauthorizedException();
    const agent = user.role === 'agent' ? await this.users.findAgentProfile(id) : undefined;
    return toMe(user, agent);
  }

  async updateMe(id: number, body: UpdateMeBody): Promise<Me> {
    await this.users.update(id, body);
    return this.getMe(id);
  }

  /** Clients and owners can delete their own account. Agents and admins are removed by an admin. */
  async deleteMe(id: number, password: string, onDeleted: () => Promise<void>): Promise<void> {
    const user = await this.users.findActiveById(id);
    if (!user) throw new UnauthorizedException();
    if (user.role === 'agent' || user.role === 'admin') {
      throw new ForbiddenException('Staff accounts are removed by an admin');
    }
    if (!(await verifyPassword(user.passwordHash, password))) throw new UnauthorizedException('Wrong password');
    await this.users.softDelete(id);
    await onDeleted();
  }
}
