import { DEFAULT_HOURS, type WeekHours } from '../../../../src/modules/viewings/slots.js';
import { isWorkingTime, needsAwayReply } from '../../../../src/modules/chat/away.js';

// Cairo is UTC+2 in November (no summer time). 2026-11-12 is a Thursday, 2026-11-13 a Friday.
const at = (iso: string) => new Date(iso);
const none = new Set<string>();

describe('isWorkingTime', () => {
  it('is the agent’s hours on that weekday, in Cairo time, until the end of the last hour', () => {
    expect(isWorkingTime(DEFAULT_HOURS, none, at('2026-11-12T08:00:00Z'))).toBe(true); // 10:00
    expect(isWorkingTime(DEFAULT_HOURS, none, at('2026-11-12T07:59:00Z'))).toBe(false); // 09:59
    expect(isWorkingTime(DEFAULT_HOURS, none, at('2026-11-12T18:59:00Z'))).toBe(true); // 20:59
    expect(isWorkingTime(DEFAULT_HOURS, none, at('2026-11-12T19:00:00Z'))).toBe(false); // 21:00
  });

  it('follows each weekday, and days off', () => {
    expect(isWorkingTime(DEFAULT_HOURS, none, at('2026-11-13T09:00:00Z'))).toBe(false); // Friday 11:00
    expect(isWorkingTime(DEFAULT_HOURS, none, at('2026-11-13T12:00:00Z'))).toBe(true); // Friday 14:00
    expect(isWorkingTime(DEFAULT_HOURS, new Set(['2026-11-12']), at('2026-11-12T10:00:00Z'))).toBe(false);
    const noThursday: WeekHours = new Map([...DEFAULT_HOURS].filter(([d]) => d !== 4));
    expect(isWorkingTime(noThursday, none, at('2026-11-12T10:00:00Z'))).toBe(false);
  });
});

describe('needsAwayReply', () => {
  it('replies once, until the agent answers in person', () => {
    expect(needsAwayReply([])).toBe(true);
    expect(needsAwayReply([{ sender: 'client' }])).toBe(true);
    expect(needsAwayReply([{ sender: 'client' }, { sender: 'agent', auto: true }, { sender: 'client' }])).toBe(false);
    expect(needsAwayReply([{ sender: 'agent', auto: true }, { sender: 'agent' }, { sender: 'client' }])).toBe(true);
  });
});
