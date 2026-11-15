import { createHash, randomBytes, randomInt } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  type AuthResponse,
  type ChangePasswordBody,
  canChangeOwnPassword,
  RESET_CODE_LENGTH,
  RESET_CODE_MINUTES,
  RESET_CODE_TRIES,
  type ResetPasswordBody,
  type SignInBody,
  type SignUpBody,
} from '@maqar/shared';
import type { Env } from '../../core/config/env.js';
import { Mailer } from '../../core/mail/mailer.js';
import { UsersRepository } from '../users/users.repository.js';
import { UsersService } from '../users/users.service.js';
import { AuthRepository } from './auth.repository.js';
import { resetCodeMail, staffResetMail } from './password-mail.js';
import { PasswordResetsRepository } from './password-resets.repository.js';
import { hashPassword, verifyPassword } from './password.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
/** The stored form of a reset code, tied to its account. */
const codeHash = (userId: number, code: string) => sha256(`${userId}:${code}`);
const BAD_CREDENTIALS = 'Wrong email or password';
const BAD_SESSION = 'Session expired, please sign in again';
const BAD_CODE = 'Wrong or expired code';
/** Asking for another code this soon sends nothing, so an inbox cannot be flooded. */
const RESEND_AFTER_MS = 60_000;

@Injectable()
export class AuthService {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly users: UsersRepository,
    private readonly profiles: UsersService,
    private readonly sessions: AuthRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly resets: PasswordResetsRepository,
    private readonly mailer: Mailer,
  ) {}

  /** Only clients sign up themselves (contract §2). The DTO refuses other roles. */
  async signUp(body: SignUpBody): Promise<AuthResponse> {
    if (await this.users.emailInUse(body.email)) throw new ConflictException('This email already has an account');
    const id = await this.users.create({
      name: body.name,
      email: body.email,
      phone: body.phone ?? null,
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

  /**
   * A signed-in client or admin sets a new password (phase 31). Every session ends, this one
   * included, and a new one is returned for this device. A wrong current password is a 403, not
   * a 401, so the app does not take it for an expired session.
   */
  async changePassword(userId: number, body: ChangePasswordBody): Promise<AuthResponse> {
    const user = await this.users.findActiveById(userId);
    if (!user) throw new UnauthorizedException(BAD_SESSION);
    if (!canChangeOwnPassword(user.role)) throw new ForbiddenException("Advisors' passwords are set by the admin");
    if (!(await verifyPassword(user.passwordHash, body.currentPassword))) throw new ForbiddenException('Wrong current password');
    if (body.newPassword === body.currentPassword) throw new BadRequestException('The new password must be different');
    return this.setPassword(userId, body.newPassword);
  }

  /**
   * Emails a code to set a new password (phase 31). The answer never says whether the email has
   * an account, and the email is sent in the background so the timing does not say it either.
   * An advisor gets a note to ask the admin instead of a code.
   */
  async forgotPassword(email: string): Promise<void> {
    const user = await this.users.findActiveByEmail(email);
    if (!user?.email) return;
    if (!canChangeOwnPassword(user.role)) {
      this.deliver(staffResetMail(user.email, user.lang, user.name));
      return;
    }
    const now = new Date();
    const earlier = await this.resets.find(user.id);
    if (earlier && now.getTime() - earlier.createdAt.getTime() < RESEND_AFTER_MS) return;
    const code = String(randomInt(0, 10 ** RESET_CODE_LENGTH)).padStart(RESET_CODE_LENGTH, '0');
    await this.resets.replace(user.id, codeHash(user.id, code), now, new Date(now.getTime() + RESET_CODE_MINUTES * 60_000));
    this.deliver(resetCodeMail(user.email, user.lang, user.name, code));
  }

  /** Sets a new password with the emailed code, and signs in (phase 31). Every older session ends. */
  async resetPassword(body: ResetPasswordBody): Promise<AuthResponse> {
    const user = await this.users.findActiveByEmail(body.email);
    if (!user || !canChangeOwnPassword(user.role)) throw new BadRequestException(BAD_CODE);
    const row = await this.resets.find(user.id);
    const now = new Date();
    if (!row || row.expiresAt <= now || row.tries >= RESET_CODE_TRIES) throw new BadRequestException(BAD_CODE);
    const hash = codeHash(user.id, body.code);
    if (hash !== row.codeHash) {
      await this.resets.addTry(row.id);
      throw new BadRequestException(BAD_CODE);
    }
    if (!(await this.resets.consume(row.id, hash, now))) throw new BadRequestException(BAD_CODE);
    return this.setPassword(user.id, body.newPassword);
  }

  /** The new password, every session ended (refresh tokens and access tokens), and a new session. */
  private async setPassword(userId: number, password: string): Promise<AuthResponse> {
    const changedAt = new Date();
    await this.users.update(userId, { passwordHash: await hashPassword(password), credentialsChangedAt: changedAt });
    await this.sessions.revokeAllForUser(userId);
    // The new access token must be issued after the change, or the check would refuse it too.
    while (Date.now() <= changedAt.getTime()) await new Promise((r) => setTimeout(r, 1));
    return this.issue(userId);
  }

  /** Sends in the background: a mail server's failure is logged, never shown to the asker. */
  private deliver(message: Parameters<Mailer['send']>[0]): void {
    this.mailer.send(message).catch((err: unknown) => this.log.error(`Password email to ${message.to} failed: ${String(err)}`));
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
