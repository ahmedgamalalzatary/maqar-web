import { REMINDER_OFFSETS, type ReminderOffset } from '@maqar/shared';

// Viewing reminder timing (contract §8.7). Pure, so the rules are tested without a clock or a database.

const OFFSET_MS: Record<ReminderOffset, number> = { '1d': 86_400_000, '2h': 7_200_000, '30m': 1_800_000 };

/** The longest a reminder comes before its viewing: viewings further ahead have nothing due. */
export const LONGEST_REMINDER_MS = Math.max(...Object.values(OFFSET_MS));

/** When this reminder is due. */
export const reminderAt = (startsAt: Date, offset: ReminderOffset) => new Date(startsAt.getTime() - OFFSET_MS[offset]);

/**
 * The choices already due when a viewing is booked or moved. They are stamped as sent at once:
 * a "1 day before" reminder for a viewing in an hour would only repeat the confirmation.
 */
export function alreadyDue(startsAt: Date, offsets: readonly ReminderOffset[], now: Date): ReminderOffset[] {
  return offsets.filter((o) => reminderAt(startsAt, o).getTime() <= now.getTime());
}

export type PendingReminder = { viewingId: number; offset: ReminderOffset; startsAt: Date };

/**
 * The unsent reminders whose time has come, one batch per viewing (they become one message, so a
 * server that was down for a while does not send three at once). Nothing once the viewing has started.
 */
export function dueBatches(rows: PendingReminder[], now: Date): { viewingId: number; offsets: ReminderOffset[] }[] {
  const out = new Map<number, ReminderOffset[]>();
  for (const r of rows) {
    if (r.startsAt.getTime() <= now.getTime() || reminderAt(r.startsAt, r.offset).getTime() > now.getTime()) continue;
    out.set(r.viewingId, [...(out.get(r.viewingId) ?? []), r.offset]);
  }
  const order = (o: ReminderOffset) => REMINDER_OFFSETS.indexOf(o);
  return [...out].map(([viewingId, offsets]) => ({ viewingId, offsets: offsets.sort((a, b) => order(a) - order(b)) }));
}
