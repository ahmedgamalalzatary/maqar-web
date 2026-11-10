import type { ChatSender } from '@maqar/shared';
import { cairoClock, type WeekHours } from '../viewings/slots.js';

// The out-of-hours reply (contract §16.1 #12). Pure, so the rules are tested without a clock.

/**
 * Inside the agent's working hours, in Cairo time: not a day off, and from the first bookable hour
 * to the end of the last one (hours 10 to 20 mean 10:00 to 20:59).
 */
export function isWorkingTime(hours: WeekHours, daysOff: Set<string>, now: Date): boolean {
  const { date, hour } = cairoClock(now);
  if (daysOff.has(date)) return false;
  const day = hours.get(new Date(`${date}T12:00:00Z`).getUTCDay());
  return !!day && hour >= day.from && hour <= day.to;
}

/**
 * Whether a client's message out of hours gets the automatic reply: once, then not again until the
 * agent has answered in person. `messages` is the conversation, oldest first.
 */
export function needsAwayReply(messages: { sender: ChatSender; auto?: boolean }[]): boolean {
  const lastAgent = [...messages].reverse().find((m) => m.sender === 'agent');
  return !lastAgent?.auto;
}
