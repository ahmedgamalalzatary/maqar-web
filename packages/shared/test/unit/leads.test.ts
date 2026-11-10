import { maskPhone, targetProgress } from '../../src/leads.js';

describe('maskPhone', () => {
  it('keeps the country code, the first three digits and the last four', () => {
    expect(maskPhone('+201014124412')).toBe('+20 101 *** 4412');
    expect(maskPhone('+20 101 412 4412')).toBe('+20 101 *** 4412');
  });

  it('masks a local number, and hides a short one altogether', () => {
    expect(maskPhone('01014124412')).toBe('010 *** 4412');
    expect(maskPhone('12345')).toBe('***');
  });

  it('is null without a number', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone('')).toBeNull();
  });
});

describe('targetProgress', () => {
  it('gives the share of the target, at most the whole bar', () => {
    expect(targetProgress({ won: 6, target: 8, teamAvg: 6 }).share).toBe(0.75);
    expect(targetProgress({ won: 10, target: 8, teamAvg: 6 }).share).toBe(1);
    expect(targetProgress({ won: 0, target: 8, teamAvg: 0 }).share).toBe(0);
  });

  it('has no bar without a target', () => {
    expect(targetProgress({ won: 3, target: 0, teamAvg: 2 }).share).toBeNull();
  });

  it('compares with the team average in whole percent', () => {
    expect(targetProgress({ won: 6, target: 8, teamAvg: 5 }).vsTeam).toBe(20);
    expect(targetProgress({ won: 4, target: 8, teamAvg: 5 }).vsTeam).toBe(-20);
    expect(targetProgress({ won: 5, target: 8, teamAvg: 5 }).vsTeam).toBe(0);
    expect(targetProgress({ won: 1, target: 8, teamAvg: 1.5 }).vsTeam).toBe(-33);
  });

  it('makes no comparison when the team has won nothing yet', () => {
    expect(targetProgress({ won: 2, target: 8, teamAvg: 0 }).vsTeam).toBeNull();
  });
});
