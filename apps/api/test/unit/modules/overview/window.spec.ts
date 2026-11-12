import { bucketByCairoDay, overviewWindow } from '../../../../src/modules/overview/overview.window.js';

describe('overviewWindow', () => {
  it('covers the last n Cairo days, today included, as UTC instants', () => {
    // 2026-11-12 23:30 in Cairo (winter: UTC+2) is 21:30 UTC.
    const w = overviewWindow(new Date('2026-11-12T21:30:00Z'), 7);
    expect(w.days).toEqual(['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
    expect(w.from.toISOString()).toBe('2026-11-05T22:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-11-12T22:00:00.000Z');
    expect(w.monthStart.toISOString()).toBe('2026-10-31T22:00:00.000Z');
  });

  it('just after midnight in Cairo, today is already the new day', () => {
    // 00:15 in Cairo on 13 November is 22:15 UTC on the 12th.
    const w = overviewWindow(new Date('2026-11-12T22:15:00Z'), 7);
    expect(w.days.at(-1)).toBe('2026-11-13');
  });

  it('in summer time (UTC+3) the day starts three hours before UTC midnight', () => {
    const w = overviewWindow(new Date('2026-07-15T10:00:00Z'), 30);
    expect(w.days).toHaveLength(30);
    expect(w.to.toISOString()).toBe('2026-07-15T21:00:00.000Z');
    expect(w.monthStart.toISOString()).toBe('2026-06-30T21:00:00.000Z');
  });
});

describe('bucketByCairoDay', () => {
  it('counts each time on its Cairo day, every day present', () => {
    const days = ['2026-11-11', '2026-11-12'];
    const times = [new Date('2026-11-11T21:59:00Z'), new Date('2026-11-11T22:01:00Z'), new Date('2026-11-12T10:00:00Z')];
    expect(bucketByCairoDay(times, days)).toEqual(new Map([['2026-11-11', 1], ['2026-11-12', 2]]));
    expect(bucketByCairoDay([], days)).toEqual(new Map([['2026-11-11', 0], ['2026-11-12', 0]]));
  });
});
