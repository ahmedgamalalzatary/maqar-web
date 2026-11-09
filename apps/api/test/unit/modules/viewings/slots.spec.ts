import { buildSlotDays, cairoClock, cairoInstant, DEFAULT_HOURS, defaultDate, type WeekHours } from '../../../../src/modules/viewings/slots.js';

// 2026-11-12 is a Thursday; 2026-11-13 a Friday.
const base = { today: '2026-11-12', nowHour: 9, hours: DEFAULT_HOURS, daysOff: new Set<string>(), taken: new Set<string>() };
const day = (days: ReturnType<typeof buildSlotDays>, date: string) => days.find((d) => d.date === date)!;
const state = (days: ReturnType<typeof buildSlotDays>, date: string, time: string) => day(days, date).slots.find((s) => s.time === time)!.state;

describe('buildSlotDays', () => {
  it('covers 14 days from today, every hour from 10:00 to 20:00', () => {
    const days = buildSlotDays(base);
    expect(days.map((d) => d.date)).toHaveLength(14);
    expect(days[0]!.date).toBe('2026-11-12');
    expect(days[13]!.date).toBe('2026-11-25');
    expect(days[0]!.slots.map((s) => s.time)).toEqual(['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']);
    expect(days[0]!.slots.every((s) => s.state === 'free')).toBe(true);
  });

  it('crosses months', () => {
    expect(buildSlotDays({ ...base, today: '2026-11-30' }).map((d) => d.date).slice(0, 3)).toEqual(['2026-11-30', '2026-12-01', '2026-12-02']);
  });

  it('marks today’s hours up to the current one as past', () => {
    const days = buildSlotDays({ ...base, nowHour: 15 });
    expect(state(days, '2026-11-12', '15:00')).toBe('past');
    expect(state(days, '2026-11-12', '10:00')).toBe('past');
    expect(state(days, '2026-11-12', '16:00')).toBe('free');
    expect(state(days, '2026-11-13', '15:00')).toBe('free');
  });

  it('is closed on Friday before 14:00', () => {
    const days = buildSlotDays(base);
    expect(state(days, '2026-11-13', '13:00')).toBe('closed');
    expect(state(days, '2026-11-13', '10:00')).toBe('closed');
    expect(state(days, '2026-11-13', '14:00')).toBe('free');
  });

  it('marks booked hours as taken', () => {
    const days = buildSlotDays({ ...base, taken: new Set(['2026-11-14 16:00']) });
    expect(state(days, '2026-11-14', '16:00')).toBe('taken');
    expect(state(days, '2026-11-14', '17:00')).toBe('free');
  });

  it('closes a whole day off or holiday, and a weekday the agent does not work', () => {
    const hours: WeekHours = new Map(DEFAULT_HOURS);
    hours.delete(6); // no Saturdays
    const days = buildSlotDays({ ...base, hours, daysOff: new Set(['2026-11-15']) });
    expect(day(days, '2026-11-15').slots.every((s) => s.state === 'closed')).toBe(true);
    expect(day(days, '2026-11-14').slots.every((s) => s.state === 'closed')).toBe(true);
    expect(state(days, '2026-11-16', '10:00')).toBe('free');
  });

  it('follows the agent’s own hours, and the grid covers all of them', () => {
    const hours: WeekHours = new Map([...DEFAULT_HOURS].map(([d]) => [d, { from: 12, to: 18 }]));
    hours.set(4, { from: 9, to: 21 }); // Thursdays longer
    const days = buildSlotDays({ ...base, nowHour: 8, hours });
    expect(day(days, '2026-11-12').slots.map((s) => s.time)).toEqual(
      ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00', '21:00'],
    );
    expect(state(days, '2026-11-12', '09:00')).toBe('free');
    expect(state(days, '2026-11-14', '11:00')).toBe('closed');
    expect(state(days, '2026-11-14', '19:00')).toBe('closed');
    expect(state(days, '2026-11-14', '18:00')).toBe('free');
  });

  it('puts past before closed before taken', () => {
    const days = buildSlotDays({ ...base, today: '2026-11-13', nowHour: 15, taken: new Set(['2026-11-13 15:00', '2026-11-13 16:00']) });
    expect(state(days, '2026-11-13', '10:00')).toBe('past');
    expect(state(days, '2026-11-13', '15:00')).toBe('past');
    expect(state(days, '2026-11-13', '16:00')).toBe('taken');
  });
});

describe('defaultDate', () => {
  it('is today, or tomorrow from 19:00, moved on to the first day with a free hour', () => {
    expect(defaultDate(buildSlotDays(base), 18)).toBe('2026-11-12');
    expect(defaultDate(buildSlotDays({ ...base, nowHour: 19 }), 19)).toBe('2026-11-13');
    const full = buildSlotDays({ ...base, daysOff: new Set(['2026-11-12', '2026-11-13']) });
    expect(defaultDate(full, 9)).toBe('2026-11-14');
  });
});

describe('Cairo time', () => {
  it('reads the Cairo day and hour of an instant, with summer time', () => {
    // Winter: UTC+2. Summer (DST): UTC+3.
    expect(cairoClock(new Date('2026-11-12T08:30:00Z'))).toEqual({ date: '2026-11-12', hour: 10 });
    expect(cairoClock(new Date('2026-11-12T22:30:00Z'))).toEqual({ date: '2026-11-13', hour: 0 });
    expect(cairoClock(new Date('2026-07-01T08:30:00Z'))).toEqual({ date: '2026-07-01', hour: 11 });
  });

  it('turns a Cairo day and hour into the instant', () => {
    expect(cairoInstant('2026-11-12', '16:00').toISOString()).toBe('2026-11-12T14:00:00.000Z');
    expect(cairoInstant('2026-07-01', '16:00').toISOString()).toBe('2026-07-01T13:00:00.000Z');
  });
});
