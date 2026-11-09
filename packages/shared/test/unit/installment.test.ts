import { installment } from '../../src/installment.js';

describe('installment', () => {
  it('splits a 0% developer plan into equal monthly payments', () => {
    expect(installment(10_000_000, 10, 5)).toEqual({
      down: 1_000_000,
      principal: 9_000_000,
      count: 60,
      payment: 150_000,
      total: 10_000_000,
    });
  });

  it('pays quarterly when asked', () => {
    const plan = installment(10_000_000, 20, 2, 0, true);
    expect(plan.count).toBe(8);
    expect(plan.payment).toBe(1_000_000);
  });

  it('adds interest with the standard loan formula', () => {
    // 1.2M over 12 months at 12% a year: 1% a month -> about 106,618.6 a month.
    const plan = installment(1_200_000, 0, 1, 12);
    expect(plan.payment).toBeCloseTo(106_618.6, 0);
    expect(plan.total).toBeCloseTo(106_618.6 * 12, -1);
  });

  it('adds interest quarterly too', () => {
    // 1M over 4 quarters at 12% a year: 3% a quarter -> about 269,027 a quarter.
    const plan = installment(1_000_000, 0, 1, 12, true);
    expect(plan.count).toBe(4);
    expect(plan.payment).toBeCloseTo(269_027.05, 1);
  });

  it('gives the demo calculator’s starting numbers', () => {
    expect(installment(8_000_000, 10, 6)).toEqual({ down: 800_000, principal: 7_200_000, count: 72, payment: 100_000, total: 8_000_000 });
  });

  it('treats no years as one payment instead of dividing by zero', () => {
    expect(installment(1_000_000, 50, 0).payment).toBe(500_000);
  });
});
