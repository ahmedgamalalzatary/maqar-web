import type { INestApplication } from '@nestjs/common';
import type { AuthResponse } from '@maqar/shared';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { vi } from 'vitest';
import { DB, type Db } from '../../src/core/db/db.module.js';
import { type MailMessage, Mailer } from '../../src/core/mail/mailer.js';
import { passwordResets } from '../../src/modules/auth/password-resets.schema.js';
import { users } from '../../src/modules/users/users.schema.js';
import { seedDemoAccounts } from '../../src/modules/users/users.seed.js';
import { createTestApp } from '../utils/app.js';
import { bearer, signInSeeded, signUp } from '../utils/auth.js';
import { resetDb } from '../utils/db.js';

// Phase 31 (2026-11-15): clients and admins change their own password, and recover a forgotten
// one with a code sent by email. Advisors ask the admin (owner's call).
describe('Passwords (e2e)', () => {
  let app: INestApplication<App>;
  let db: Db;
  let mail: MailMessage[];
  const http = () => request(app.getHttpServer());
  const signIn = (email: string, password: string) => http().post('/v1/auth/sign-in').send({ email, password });
  const change = (token: string, currentPassword: string, newPassword: string) =>
    http().put('/v1/me/password').set(bearer(token)).send({ currentPassword, newPassword });
  const forgot = (email: string) => http().post('/v1/auth/forgot-password').send({ email });
  const reset = (email: string, code: string, newPassword = 'Fresh4567') => http().post('/v1/auth/reset-password').send({ email, code, newPassword });
  /** The code in the last email sent to this address. */
  const codeFor = (email: string) => {
    const last = mail.filter((m) => m.to === email).at(-1);
    return last?.text.match(/\b\d{6}\b/)?.[0];
  };
  const idOf = async (email: string) => (await db.select({ id: users.id }).from(users).where(eq(users.email, email)))[0]!.id;
  /** Moves this account's code back in time, as if `minutes` had passed. */
  const age = async (email: string, minutes: number) => {
    const shift = minutes * 60_000;
    const [row] = await db.select().from(passwordResets).where(eq(passwordResets.userId, await idOf(email)));
    await db
      .update(passwordResets)
      .set({ createdAt: new Date(row!.createdAt.getTime() - shift), expiresAt: new Date(row!.expiresAt.getTime() - shift) })
      .where(eq(passwordResets.id, row!.id));
  };

  beforeAll(async () => {
    await resetDb();
    app = await createTestApp();
    db = app.get<Db>(DB);
    await seedDemoAccounts(db, process.env.SEED_PASSWORD!);
  });
  beforeEach(() => {
    mail = [];
    vi.spyOn(app.get(Mailer), 'send').mockImplementation(async (m) => {
      mail.push(m);
    });
  });
  afterEach(() => vi.restoreAllMocks());
  afterAll(async () => {
    await app.close();
  });

  describe('changing it while signed in', () => {
    it('a client gets a new session here, and every other session ends', async () => {
      const first = await signUp(app, { email: 'change@test.maqar' });
      const other = (await signIn('change@test.maqar', 'Secret123').expect(200)).body as AuthResponse;
      const res = await change(first.accessToken, 'Secret123', 'Newpass456').expect(200);
      const fresh = res.body as AuthResponse;
      expect(fresh.user.email).toBe('change@test.maqar');
      await http().get('/v1/me').set(bearer(fresh.accessToken)).expect(200);
      await http().post('/v1/auth/refresh').send({ refreshToken: fresh.refreshToken }).expect(200);
      // The old sessions, on this phone and on any other, are over.
      await http().get('/v1/me').set(bearer(other.accessToken)).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: other.refreshToken }).expect(401);
      await http().post('/v1/auth/refresh').send({ refreshToken: first.refreshToken }).expect(401);
      await signIn('change@test.maqar', 'Secret123').expect(401);
      await signIn('change@test.maqar', 'Newpass456').expect(200);
    });

    it('needs the current password, and keeps the old one when it is wrong', async () => {
      const me = await signUp(app, { email: 'wrong-current@test.maqar' });
      const res = await change(me.accessToken, 'Nope12345', 'Newpass456').expect(403);
      expect(res.body.message).toBe('Wrong current password');
      // A wrong current password must not end the session (a 401 would sign the app out).
      await http().get('/v1/me').set(bearer(me.accessToken)).expect(200);
      await signIn('wrong-current@test.maqar', 'Secret123').expect(200);
    });

    it('refuses a weak new password, or the same one again', async () => {
      const me = await signUp(app);
      await change(me.accessToken, 'Secret123', 'short1').expect(400);
      await change(me.accessToken, 'Secret123', 'lettersonly').expect(400);
      await change(me.accessToken, 'Secret123', 'Secret123').expect(400);
    });

    it('an admin changes their own; an advisor cannot', async () => {
      const admin = await signInSeeded(app, 'admin@maqar.app');
      await change(admin, process.env.SEED_PASSWORD!, 'Admin7890').expect(200);
      await signIn('admin@maqar.app', 'Admin7890').expect(200);
      const omar = await signInSeeded(app, 'omar@maqar.app');
      await change(omar, process.env.SEED_PASSWORD!, 'Agent7890').expect(403);
      await signIn('omar@maqar.app', process.env.SEED_PASSWORD!).expect(200);
    });
  });

  describe('a forgotten password', () => {
    it('a client gets a code by email, sets a new password with it, and is signed in', async () => {
      const before = await signUp(app, { email: 'forgot@test.maqar', lang: 'en' });
      await forgot('Forgot@test.maqar').expect(204);
      expect(mail).toHaveLength(1);
      expect(mail[0]).toMatchObject({ to: 'forgot@test.maqar' });
      const code = codeFor('forgot@test.maqar')!;
      expect(code).toMatch(/^\d{6}$/);
      const res = await reset('forgot@test.maqar', code).expect(200);
      expect((res.body as AuthResponse).user.email).toBe('forgot@test.maqar');
      await signIn('forgot@test.maqar', 'Secret123').expect(401);
      await signIn('forgot@test.maqar', 'Fresh4567').expect(200);
      // Sessions from before the reset are over, and the code is spent.
      await http().post('/v1/auth/refresh').send({ refreshToken: before.refreshToken }).expect(401);
      await reset('forgot@test.maqar', code, 'Again4567').expect(400);
    });

    it('the email is in the account’s language', async () => {
      await signUp(app, { email: 'arabic@test.maqar', lang: 'ar' });
      await forgot('arabic@test.maqar').expect(204);
      expect(mail[0]!.subject).toMatch(/كلمة السر/);
    });

    it('answers the same for an email with no account, and sends nothing', async () => {
      await forgot('nobody@test.maqar').expect(204);
      expect(mail).toHaveLength(0);
      await reset('nobody@test.maqar', '123456').expect(400);
    });

    it('an advisor is told by email to ask the admin, and gets no code', async () => {
      await forgot('omar@maqar.app').expect(204);
      expect(mail).toHaveLength(1);
      expect(codeFor('omar@maqar.app')).toBeUndefined();
      expect(mail[0]!.text).toMatch(/admin|الإدارة/i);
    });

    it('a suspended account gets nothing', async () => {
      await signUp(app, { email: 'suspended@test.maqar' });
      await db.update(users).set({ suspendedAt: new Date() }).where(eq(users.email, 'suspended@test.maqar'));
      await forgot('suspended@test.maqar').expect(204);
      expect(mail).toHaveLength(0);
    });

    it('a code dies after five wrong tries, even for the right code after', async () => {
      await signUp(app, { email: 'tries@test.maqar' });
      await forgot('tries@test.maqar').expect(204);
      const code = codeFor('tries@test.maqar')!;
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i += 1) await reset('tries@test.maqar', wrong).expect(400);
      await reset('tries@test.maqar', code).expect(400);
      await signIn('tries@test.maqar', 'Secret123').expect(200);
    });

    it('a code is good for 15 minutes', async () => {
      await signUp(app, { email: 'late@test.maqar' });
      await forgot('late@test.maqar').expect(204);
      const code = codeFor('late@test.maqar')!;
      await age('late@test.maqar', 16);
      await reset('late@test.maqar', code).expect(400);
    });

    it('asking again within a minute sends nothing new; after it, a new code replaces the old', async () => {
      await signUp(app, { email: 'again@test.maqar' });
      await forgot('again@test.maqar').expect(204);
      const first = codeFor('again@test.maqar')!;
      await forgot('again@test.maqar').expect(204);
      expect(mail).toHaveLength(1);
      await age('again@test.maqar', 2);
      await forgot('again@test.maqar').expect(204);
      expect(mail).toHaveLength(2);
      const second = codeFor('again@test.maqar')!;
      if (second !== first) await reset('again@test.maqar', first).expect(400);
      await reset('again@test.maqar', second).expect(200);
    });

    it('refuses a weak new password without spending the code', async () => {
      await signUp(app, { email: 'weak@test.maqar' });
      await forgot('weak@test.maqar').expect(204);
      const code = codeFor('weak@test.maqar')!;
      await reset('weak@test.maqar', code, 'short').expect(400);
      await reset('weak@test.maqar', code).expect(200);
    });
  });
});
