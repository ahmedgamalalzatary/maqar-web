import { compareMonthly, compareVerdict, type CompareHome, winner } from '../../src/compare.js';

const home = (over: Partial<CompareHome> = {}): CompareHome => ({
  category: 'sale',
  price: 10_000_000,
  sizeM2: 200,
  plan: { downPct: 10, years: 5 },
  delivery: 'ready',
  ...over,
});

describe('winner', () => {
  it('marks the lower value when lower is better', () => {
    expect(winner([5, 7], 'low')).toBe(0);
    expect(winner([9, 7], 'low')).toBe(1);
  });

  it('marks the higher value when higher is better', () => {
    expect(winner([5, 7], 'high')).toBe(1);
    expect(winner([9, 7], 'high')).toBe(0);
  });

  it('marks nothing on a tie, a missing value, or a row with no better side', () => {
    expect(winner([7, 7], 'low')).toBeNull();
    expect(winner([null, 7], 'low')).toBeNull();
    expect(winner([7, null], 'high')).toBeNull();
    expect(winner([5, 7], null)).toBeNull();
  });
});

describe('compareMonthly', () => {
  it('uses the listing plan for homes to buy', () => {
    expect(compareMonthly(home())).toEqual({ payment: 150_000, downPct: 10, years: 5, estimated: false });
  });

  it('falls back to 20% over 5 years without a plan, as the demo does, and says it is an estimate', () => {
    expect(compareMonthly(home({ plan: null }))).toEqual({ payment: 133_333.33333333334, downPct: 20, years: 5, estimated: true });
    expect(compareMonthly(home())).toEqual({ payment: 150_000, downPct: 10, years: 5, estimated: false });
  });

  it('has none for rent and stays', () => {
    expect(compareMonthly(home({ category: 'rent' }))).toBeNull();
    expect(compareMonthly(home({ category: 'stay' }))).toBeNull();
  });
});

describe('compareVerdict', () => {
  const en = (a: CompareHome, b: CompareHome, scores?: [number, number]) =>
    compareVerdict(a, b, scores).map((v) => `${v.who === 0 ? 'A' : 'B'}: ${v.text.en}`);

  it('sums up price per m², size, installment, delivery and fit', () => {
    const a = home({ price: 10_000_000, sizeM2: 200, delivery: 2028 });
    const b = home({ price: 9_000_000, sizeM2: 150 });
    expect(en(a, b, [80, 64])).toEqual([
      'A: 17% cheaper per m²',
      'A: 50 m² bigger',
      'B: EGP 15,000 less per month',
      'B: Ready to move in now',
      'A: Better fit for you (80% match)',
    ]);
  });

  it('writes the Arabic lines with Arabic digits', () => {
    const a = home({ price: 10_000_000, sizeM2: 200, delivery: 2028 });
    const b = home({ price: 9_000_000, sizeM2: 150 });
    expect(compareVerdict(a, b, [80, 64]).map((v) => v.text.ar)).toEqual([
      'أرخص في سعر المتر بـ ١٧٪',
      'أكبر بـ ٥٠ م²',
      'قسط شهري أقل بـ ١٥٬٠٠٠ ج.م',
      'جاهزة للسكن فوراً',
      'أنسب لتفضيلاتك (٨٠٪ تطابق)',
    ]);
  });

  it('skips price per m² across categories and when within 3%', () => {
    const sale = home({ price: 10_000_000, sizeM2: 200 });
    expect(en(sale, home({ category: 'project', price: 5_000_000, sizeM2: 200 }))).not.toContainEqual(
      expect.stringContaining('per m²'),
    );
    expect(en(sale, home({ price: 10_250_000, sizeM2: 200 }))).not.toContainEqual(expect.stringContaining('per m²'));
  });

  it('says nothing about two equal homes', () => {
    expect(compareVerdict(home(), home(), [70, 70])).toEqual([]);
  });

  it('leaves the installment out when either home has none, and fit out without scores', () => {
    const lines = en(home(), home({ category: 'rent', price: 50_000, sizeM2: 200 }));
    expect(lines.some((l) => l.includes('per month'))).toBe(false);
    expect(lines.some((l) => l.includes('fit'))).toBe(false);
  });

  it('qualifies the installment line when either payment rests on the assumed plan', () => {
    const real = home();
    const assumed = home({ plan: null, price: 9_000_000, sizeM2: 200 });
    const lines = en(real, assumed);
    const monthly = lines.find((l) => l.includes('per month'));
    expect(monthly).toContain('assumed');
  });
});
