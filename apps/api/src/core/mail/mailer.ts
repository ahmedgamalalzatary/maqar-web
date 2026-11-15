import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';
import type { Env } from '../config/env.js';

export type MailMessage = { to: string; subject: string; text: string; html: string };

/**
 * Sends email over SMTP (phase 31: password-reset codes). Without SMTP_HOST nothing leaves:
 * outside production the email is written to the log, so a code can be read while developing;
 * in production only a warning is logged, never the code.
 */
@Injectable()
export class Mailer {
  private readonly log = new Logger(Mailer.name);
  private readonly transport: Transporter | undefined;
  private readonly from: string | undefined;
  private readonly production: boolean;

  constructor(config: ConfigService<Env, true>) {
    const host = config.get('SMTP_HOST', { infer: true });
    const port = config.get('SMTP_PORT', { infer: true });
    const user = config.get('SMTP_USER', { infer: true });
    const pass = config.get('SMTP_PASS', { infer: true });
    this.production = config.get('NODE_ENV', { infer: true }) === 'production';
    this.from = config.get('MAIL_FROM', { infer: true }) ?? user;
    if (host) this.transport = createTransport({ host, port, secure: port === 465, auth: user ? { user, pass } : undefined });
  }

  async send(message: MailMessage): Promise<void> {
    if (!this.transport) {
      if (this.production) this.log.warn(`Email to ${message.to} not sent: SMTP_HOST is not set`);
      else this.log.log(`Email (not sent, no SMTP_HOST) to ${message.to}: ${message.subject}\n${message.text}`);
      return;
    }
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

@Global()
@Module({ providers: [Mailer], exports: [Mailer] })
export class MailModule {}
