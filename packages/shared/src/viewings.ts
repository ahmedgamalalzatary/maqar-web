// Viewing rules both sides need (contract §8.7, §8.8).

import type { ViewingItem } from './api.js';

/** How many days ahead a viewing can be booked. */
export const BOOKING_DAYS = 14;
/** A viewing lasts this long (the calendar event too). */
export const VIEWING_MINUTES = 45;

/** Confirmed or rescheduled: it still takes the agent's hour. */
export const isActiveViewing = (v: Pick<ViewingItem, 'status'>) => v.status === 'confirmed' || v.status === 'rescheduled';

/** Upcoming until an hour after it started (as in the demo); everything else is past. */
export function isUpcoming(v: Pick<ViewingItem, 'status' | 'startsAt'>, now = Date.now()): boolean {
  return isActiveViewing(v) && new Date(v.startsAt).getTime() > now - 3_600_000;
}
