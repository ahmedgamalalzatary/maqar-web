import { createHash, randomBytes } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthResponse, SignInBody, SignUpBody } from '@maqar/shared';
import type { Env } from '../../core/config/env.js';
import { UsersRepository } from '../users/users.repository.js';
import { UsersService } from '../users/users.service.js';
import { AuthRepository } from './auth.repository.js';
import { hashPassword, verifyPassword } from './password.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const BAD_CREDENTIALS = 'Wrong email or password';
const BAD_SESSION = 'Session expired, please sign in again';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly profiles: UsersService,
    private readonly sessions: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Only clients sign up themselves (contract §2). The DTO refuses other roles. */
  async signUp(body: SignUpBody): Promise<AuthResponse> {
    if (await this.users.emailInUse(body.email)) throw new ConflictException('This email already has an account');
    const id = await this.users.create({
      name: body.name,
      email: body.email,
      role: 'client',
      lang: body.lang ?? 'ar',
      passwordHash: await hashPassword(body.password),
    });
    return this.issue(id);
  }

  async signIn(body: SignInBody): Promise<AuthResponse> {
    const user = await this.users.findActiveByEmail(body.email);
    // Same answer for an unknown email and a wrong password, so accounts cannot be probed.
    if (!user || !(await verifyPassword(user.passwordHash, body.password))) {
      throw new UnauthorizedException(BAD_CREDENTIALS);
    }
    return this.issue(user.id);
  }

  /**
   * Rotates the refresh token. A token that was already used means it was copied:
   * every session of that account is ended.
   */
  async refresh(refreshToken: string): Promise<AuthResponse> {
    const row = await this.sessions.findByHash(sha256(refreshToken));
    // An expired token is simply refused: retrying it is not a sign of theft.
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedException(BAD_SESSION);
    if (row.revokedAt || !(await this.sessions.revoke(row.id))) {
      await this.sessions.revokeAllForUser(row.userId);
      throw new UnauthorizedException(BAD_SESSION);
    }
    if (!(await this.users.findActiveById(row.userId))) throw new UnauthorizedException(BAD_SESSION);
    return this.issue(row.userId);
  }

  async signOut(refreshToken: string): Promise<void> {
    const row = await this.sessions.findByHash(sha256(refreshToken));
    if (row) await this.sessions.revoke(row.id);
  }

  private async issue(userId: number): Promise<AuthResponse> {
    const user = await this.profiles.getMe(userId);
    const accessToken = await this.jwt.signAsync({ sub: user.id, role: user.role, iatMs: Date.now() });
    const { exp, iat } = this.jwt.decode<{ exp: number; iat: number }>(accessToken);

    const refreshToken = randomBytes(32).toString('base64url');
    const days = this.config.get('REFRESH_TTL_DAYS', { infer: true });
    await this.sessions.create(user.id, sha256(refreshToken), new Date(Date.now() + days * 86_400_000));

    return { user, accessToken, refreshToken, expiresIn: exp - iat };
  }
}
