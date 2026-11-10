import { alreadyDue, dueBatches, reminderAt } from '../../../../src/modules/viewings/reminders.js';

const MIN = 60_000;
const startsAt = new Date('2026-11-13T15:00:00.000Z');
const before = (ms: number) => new Date(startsAt.getTime() - ms);

describe('reminderAt', () => {
  it('is 1 day, 2 hours or 30 minutes before the viewing', () => {
    expect(reminderAt(startsAt, '1d').toISOString()).toBe('2026-11-12T15:00:00.000Z');
    expect(reminderAt(startsAt, '2h').toISOString()).toBe('2026-11-13T13:00:00.000Z');
    expect(reminderAt(startsAt, '30m').toISOString()).toBe('2026-11-13T14:30:00.000Z');
  });
});

describe('alreadyDue', () => {
  it('lists the choices whose time has passed when booking, so they are never sent', () => {
    // Booked 35 minutes ahead: only the 30-minute reminder is still to come.
    expect(alreadyDue(startsAt, ['1d', '2h', '30m'], before(35 * MIN))).toEqual(['1d', '2h']);
    expect(alreadyDue(startsAt, ['1d', '2h', '30m'], before(3 * 86_400_000))).toEqual([]);
    // Exactly at its time counts as due.
    expect(alreadyDue(startsAt, ['30m'], before(30 * MIN))).toEqual(['30m']);
  });
});

describe('dueBatches', () => {
  const row = (viewingId: number, offset: '1d' | '2h' | '30m', at = startsAt) => ({ viewingId, offset, startsAt: at });

  it('picks the reminders whose time has come, one batch per viewing', () => {
    const one = [row(1, '1d'), row(1, '2h'), row(1, '30m')];
    expect(dueBatches(one, before(2 * 60 * MIN))).toEqual([{ viewingId: 1, offsets: ['1d', '2h'] }]);
    expect(dueBatches(one, before(2 * 60 * MIN + 1))).toEqual([{ viewingId: 1, offsets: ['1d'] }]);
    expect(dueBatches(one, before(2 * 86_400_000))).toEqual([]);
    const rows = [...one, row(2, '1d', new Date(startsAt.getTime() + 60 * MIN))];
    expect(dueBatches(rows, before(29 * MIN))).toEqual([
      { viewingId: 1, offsets: ['1d', '2h', '30m'] },
      { viewingId: 2, offsets: ['1d'] },
    ]);
  });

  it('sends nothing once the viewing has started', () => {
    expect(dueBatches([row(1, '30m')], startsAt)).toEqual([]);
    expect(dueBatches([row(1, '30m')], new Date(startsAt.getTime() + MIN))).toEqual([]);
  });
});
