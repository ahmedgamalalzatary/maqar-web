import { Injectable, Logger } from '@nestjs/common';
import type { PushData } from '@maqar/shared';

/** One phone push, in the receiver's language. */
export type PushMessage = { to: string; title: string; body: string; data: PushData; badge: number };

/** What happened to each message: `gone` means the phone dropped the token, so stop using it. */
export type PushOutcome = 'sent' | 'gone' | 'failed';

/** Sends phone pushes. The real one is Expo's push service (contract §16.1 #3). */
export abstract class PushSender {
  abstract send(messages: PushMessage[]): Promise<PushOutcome[]>;
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
/** Expo takes at most 100 messages per request. */
const CHUNK = 100;

type Ticket = { status: 'ok'; id: string } | { status: 'error'; message: string; details?: { error?: string } };

@Injectable()
export class ExpoPushSender extends PushSender {
  private readonly log = new Logger('Push');

  constructor(private readonly accessToken?: string) {
    super();
  }

  async send(messages: PushMessage[]): Promise<PushOutcome[]> {
    const out: PushOutcome[] = [];
    for (let i = 0; i < messages.length; i += CHUNK) out.push(...(await this.sendChunk(messages.slice(i, i + CHUNK))));
    return out;
  }

  private async sendChunk(messages: PushMessage[]): Promise<PushOutcome[]> {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(this.accessToken && { Authorization: `Bearer ${this.accessToken}` }),
        },
        // `default` is the Android channel the app creates; iOS plays the default sound.
        body: JSON.stringify(messages.map((m) => ({ ...m, sound: 'default', channelId: 'default', priority: 'high' }))),
        signal: AbortSignal.timeout(10_000),
      });
      const json = (await res.json().catch(() => ({}))) as { data?: Ticket[] };
      if (!res.ok || !Array.isArray(json.data)) {
        this.log.warn(`Expo push answered ${res.status}`);
        return messages.map(() => 'failed');
      }
      return messages.map((_, k) => {
        const t = json.data![k];
        if (t?.status === 'ok') return 'sent';
        if (t?.details?.error === 'DeviceNotRegistered') return 'gone';
        this.log.warn(`Push not sent: ${t?.message ?? 'no ticket'}`);
        return 'failed';
      });
    } catch (err) {
      this.log.warn(`Expo push unreachable: ${(err as Error).message}`);
      return messages.map(() => 'failed');
    }
  }
}

/**
 * Keeps pushes in memory instead of sending them: the e2e tests read `sent`, and a token
 * listed in `gone` answers as a phone that dropped it.
 */
export class MemoryPushSender extends PushSender {
  readonly sent: PushMessage[] = [];
  readonly gone = new Set<string>();

  async send(messages: PushMessage[]): Promise<PushOutcome[]> {
    this.sent.push(...messages.filter((m) => !this.gone.has(m.to)));
    return messages.map((m) => (this.gone.has(m.to) ? 'gone' : 'sent'));
  }
}
