import { areaSlug, DAYS_OFF_MAX, daysBetween, weekProblem } from '../../src/admin-tools.js';

describe('areaSlug', () => {
  it('makes a readable id from the English name', () => {
    expect(areaSlug('New Cairo')).toBe('new-cairo');
    expect(areaSlug("  Sheikh Zayed's  6th of October ")).toBe('sheikh-zayeds-6th-of-october');
    expect(areaSlug('El-Gouna / Hurghada')).toBe('el-gouna-hurghada');
  });
  it('is empty when nothing Latin is left, and at most 40 characters', () => {
    expect(areaSlug('التجمع')).toBe('');
    expect(areaSlug('a'.repeat(60))).toHaveLength(40);
  });
});

describe('daysBetween', () => {
  it('lists every Cairo day from the first to the last, both included', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toEqual(['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
    expect(daysBetween('2026-11-12', '2026-11-12')).toEqual(['2026-11-12']);
  });
  it('is empty when the last day is before the first, or the range is too long', () => {
    expect(daysBetween('2026-11-12', '2026-11-11')).toEqual([]);
    expect(daysBetween('2026-01-01', '2026-12-31')).toEqual([]);
    expect(daysBetween('2026-01-01', '2026-01-01').length).toBeLessThanOrEqual(DAYS_OFF_MAX);
  });
});

describe('weekProblem', () => {
  it('accepts a week with days left out (days off)', () => {
    expect(weekProblem([{ weekday: 0, from: 10, to: 20 }, { weekday: 5, from: 14, to: 20 }])).toBeNull();
    expect(weekProblem([])).toBeNull();
  });
  it('refuses a day twice, a day that ends before it starts, and hours outside the day', () => {
    expect(weekProblem([{ weekday: 1, from: 10, to: 20 }, { weekday: 1, from: 12, to: 18 }])).toBe('twice');
    expect(weekProblem([{ weekday: 1, from: 20, to: 10 }])).toBe('order');
    expect(weekProblem([{ weekday: 7, from: 10, to: 20 }])).toBe('range');
    expect(weekProblem([{ weekday: 1, from: 10, to: 24 }])).toBe('range');
  });
});
