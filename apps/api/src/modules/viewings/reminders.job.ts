import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ViewingsService } from './viewings.service.js';

/**
 * Runs the reminders every minute inside the API (decided in contract §16.1 #13: no separate queue).
 * Not loaded in tests; they call `sendDueReminders` with their own clock.
 */
@Injectable()
export class RemindersJob {
  private readonly log = new Logger(RemindersJob.name);
  private running = false;

  constructor(private readonly viewings: ViewingsService) {}

  @Interval(60_000)
  async tick(): Promise<void> {
    // A slow run (many reminders, a slow push service) never overlaps the next one.
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.viewings.sendDueReminders();
      if (sent) this.log.log(`Sent ${sent} viewing reminder(s)`);
    } catch (err) {
      this.log.error('Viewing reminders failed', err as Error);
    } finally {
      this.running = false;
    }
  }
}
