import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from '../../common/decorators/current-user.decorator.js';
import { UsersRepository } from '../users/users.repository.js';

/**
 * Who an access token belongs to: the HTTP guard and the chat socket both ask here, so they
 * accept exactly the same tokens. The account is re-read, so a deleted account loses access at once.
 */
@Injectable()
export class TokenUsers {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
  ) {}

  async userOf(token: string | undefined): Promise<AuthUser | undefined> {
    if (!token) return undefined;
    const payload = await this.jwt.verifyAsync<{ sub?: unknown; iat?: number; iatMs?: unknown }>(token).catch(() => null);
    const sub = payload?.sub;
    const user = typeof sub === 'number' && Number.isInteger(sub) ? await this.users.findActiveById(sub) : undefined;
    if (!user) return undefined;
    // A password or email change invalidates every access token issued before it (SEC-02). Tokens carry
    // their issue time in milliseconds (`iatMs`): with whole-second `iat` alone, a token issued in the same
    // second as the change could not be told apart. An older token without it counts from its second.
    const issued = typeof payload?.iatMs === 'number' ? payload.iatMs : payload?.iat ? payload.iat * 1000 : undefined;
    if (user.credentialsChangedAt && (issued === undefined || issued <= user.credentialsChangedAt.getTime())) return undefined;
    return { id: user.id, role: user.role };
  }
}
