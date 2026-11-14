import { calculatorProblem, DEFAULT_APP_SETTINGS, HOME_SECTIONS, homeSectionOrder, splashProblem, yearsLimits } from '../../src/settings.js';

describe('app settings the admin controls (phase 29)', () => {
  it('orders the Home sections as saved, and never loses or repeats one', () => {
    expect(homeSectionOrder([])).toEqual([...HOME_SECTIONS]);
    const order = homeSectionOrder(['launches', 'areas', 'launches', 'gone']);
    expect(order.slice(0, 2)).toEqual(['launches', 'areas']);
    expect([...order].sort()).toEqual([...HOME_SECTIONS].sort());
  });

  it('takes a calculator whose numbers make sense', () => {
    expect(calculatorProblem(DEFAULT_APP_SETTINGS.calculator)).toBeNull();
    expect(calculatorProblem({ minDownPct: 10, minYears: 2, maxYears: 8 })).toBeNull();
    expect(calculatorProblem({ minDownPct: 12, minYears: 1, maxYears: 10 })).toBe('down');
    expect(calculatorProblem({ minDownPct: 55, minYears: 1, maxYears: 10 })).toBe('down');
    expect(calculatorProblem({ minDownPct: 10, minYears: 0, maxYears: 10 })).toBe('years');
    expect(calculatorProblem({ minDownPct: 10, minYears: 6, maxYears: 5 })).toBe('years');
    expect(calculatorProblem({ minDownPct: 10, minYears: 1, maxYears: 31 })).toBe('years');
  });

  it('lets a listing with its own plan go past the limits', () => {
    const c = { minDownPct: 10, minYears: 3, maxYears: 8 };
    expect(yearsLimits(c, 5)).toEqual({ min: 3, max: 8 });
    expect(yearsLimits(c, 12)).toEqual({ min: 3, max: 12 });
    expect(yearsLimits(c, 1)).toEqual({ min: 1, max: 8 });
  });

  it('wants a file for an image or video splash, and short text', () => {
    expect(splashProblem({ kind: 'none', media: null, textAr: '', textEn: '' })).toBeNull();
    expect(splashProblem({ kind: 'image', media: null, textAr: '', textEn: '' })).toBe('media');
    expect(splashProblem({ kind: 'video', media: '/uploads/videos/a.mp4', textAr: 'أهلا', textEn: 'Hi' })).toBeNull();
    expect(splashProblem({ kind: 'none', media: null, textAr: 'x'.repeat(81), textEn: '' })).toBe('text');
  });
});
