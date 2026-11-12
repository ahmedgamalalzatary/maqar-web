import { firstReplies } from '../../../../src/modules/reports/chat-times.js';
import { median, perDay } from '../../../../src/modules/reports/reports.util.js';

const at = (hhmm: string, day = '2026-11-10') => new Date(`${day}T${hhmm}:00.000Z`);
const thread = (id: number, created: string, agentId = 3) => ({ id, clientId: 9, agentId, propertyId: 1, createdAt: at(created), blockedAt: null, blockedBy: null });
const w = { from: at('00:00'), to: at('00:00', '2026-11-11') };

describe('first reply times (phase 27)', () => {
  it('runs from the client’s first message to the advisor’s first answer after it', () => {
    const out = firstReplies(
      [thread(1, '09:00'), thread(2, '10:00'), thread(3, '11:00'), thread(4, '12:00'), thread(5, '09:00', 4)],
      [
        // 1: asked at 09:05, answered at 09:50 (an earlier advisor message does not count).
        { threadId: 1, sender: 'agent', createdAt: at('09:00') },
        { threadId: 1, sender: 'client', createdAt: at('09:05') },
        { threadId: 1, sender: 'client', createdAt: at('09:10') },
        { threadId: 1, sender: 'agent', createdAt: at('09:50') },
        // 2: asked, never answered.
        { threadId: 2, sender: 'client', createdAt: at('10:01') },
        // 3: only the advisor wrote: left out.
        { threadId: 3, sender: 'agent', createdAt: at('11:00') },
        // 5: another advisor, answered after two hours.
        { threadId: 5, sender: 'client', createdAt: at('09:00') },
        { threadId: 5, sender: 'agent', createdAt: at('11:00') },
      ],
      w,
    );
    expect(out).toEqual([
      { threadId: 1, agentId: 3, minutes: 45 },
      { threadId: 2, agentId: 3, minutes: null },
      { threadId: 5, agentId: 4, minutes: 120 },
    ]);
  });

  it('counts only conversations started in the range', () => {
    const out = firstReplies([thread(1, '09:00'), { ...thread(2, '09:00'), createdAt: at('09:00', '2026-11-09') }], [{ threadId: 2, sender: 'client', createdAt: at('09:00') }], w);
    expect(out).toEqual([]);
  });

  it('median and per-day counts', () => {
    expect(median([])).toBeNull();
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    // Cairo days: 23:30 UTC on the 10th is already the 11th in Cairo.
    expect(perDay([at('10:00'), at('23:30')], ['2026-11-10', '2026-11-11'])).toEqual([
      { date: '2026-11-10', value: 1 },
      { date: '2026-11-11', value: 1 },
    ]);
  });
});
