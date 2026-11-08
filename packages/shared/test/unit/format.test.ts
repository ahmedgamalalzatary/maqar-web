import { fmtCompact, fmtDate, fmtMoney, fmtNum, fmtPct, fmtTime, localDigits, relTime } from '../../src/format.js';

describe('localDigits', () => {
  it('uses Arabic-Indic digits in Arabic only', () => {
    expect(localDigits('2026', 'ar')).toBe('٢٠٢٦');
    expect(localDigits('2026', 'en')).toBe('2026');
  });
});

describe('fmtNum', () => {
  it('groups thousands with the locale separators', () => {
    expect(fmtNum(1234567.5, 'ar')).toBe('١٬٢٣٤٬٥٦٧٫٥');
    expect(fmtNum(1234567.5, 'en')).toBe('1,234,567.5');
  });
  it('drops trailing zeros and rounds to maxFrac', () => {
    expect(fmtNum(3.1, 'en')).toBe('3.1');
    expect(fmtNum(2.005, 'en', 0)).toBe('2');
    expect(fmtNum(0, 'ar')).toBe('٠');
  });
  it('keeps the sign of negatives, but not of a rounded -0', () => {
    expect(fmtNum(-1500, 'en')).toBe('-1,500');
    expect(fmtNum(-0.001, 'en')).toBe('0');
  });
});

describe('fmtCompact', () => {
  it('uses مليون / ألف in Arabic and M / K in English', () => {
    expect(fmtCompact(11_200_000, 'ar')).toBe('١١٫٢ مليون');
    expect(fmtCompact(11_200_000, 'en')).toBe('11.2M');
    expect(fmtCompact(500_000, 'ar')).toBe('٥٠٠ ألف');
    expect(fmtCompact(500_000, 'en')).toBe('500K');
    expect(fmtCompact(1_500_000_000, 'ar')).toBe('١٫٥ مليار');
  });
  it('keeps up to 2 decimals for millions', () => {
    expect(fmtCompact(11_250_000, 'en')).toBe('11.25M');
  });
  it('moves up a unit instead of showing 1000K', () => {
    expect(fmtCompact(999_999, 'en')).toBe('1M');
  });
  it('leaves small numbers as they are', () => {
    expect(fmtCompact(950, 'en')).toBe('950');
  });
});

describe('fmtMoney', () => {
  it('formats large amounts compactly', () => {
    expect(fmtMoney(11_200_000, 'ar')).toBe('١١٫٢ مليون ج.م');
    expect(fmtMoney(11_200_000, 'en')).toBe('EGP 11.2M');
  });
  it('shows smaller amounts in full', () => {
    expect(fmtMoney(45_000, 'ar')).toBe('٤٥٬٠٠٠ ج.م');
    expect(fmtMoney(45_000, 'en')).toBe('EGP 45,000');
  });
  it('can be forced to the full amount', () => {
    expect(fmtMoney(11_200_000, 'en', false)).toBe('EGP 11,200,000');
  });
});

describe('fmtPct', () => {
  it('uses ٪ after the number in Arabic', () => {
    expect(fmtPct(5, 'ar')).toBe('٥٪');
    expect(fmtPct(5, 'en')).toBe('5%');
  });
  it('shows a drop with a minus sign', () => {
    expect(fmtPct(-6, 'ar')).toBe('٦٪-');
    expect(fmtPct(-6, 'en')).toBe('-6%');
  });
  it('keeps one decimal by default', () => {
    expect(fmtPct(12.34, 'en')).toBe('12.3%');
  });
  it('drops the minus sign when a small drop rounds to zero', () => {
    expect(fmtPct(-0.04, 'en')).toBe('0%');
    expect(fmtPct(-0.04, 'ar')).toBe('٠٪');
  });
});

describe('fmtTime', () => {
  it('shows 12-hour time with a period word', () => {
    expect(fmtTime('16:00', 'ar')).toBe('٤:٠٠ م');
    expect(fmtTime('16:00', 'en')).toBe('4:00 PM');
    expect(fmtTime('10:30', 'ar')).toBe('١٠:٣٠ ص');
    expect(fmtTime('00:00', 'en')).toBe('12:00 AM');
    expect(fmtTime('12:00', 'en')).toBe('12:00 PM');
  });
});

describe('fmtDate', () => {
  const d = '2026-11-12'; // a Thursday

  it('reads a plain date as a local calendar day', () => {
    expect(fmtDate(d, 'ar')).toBe('١٢ نوفمبر');
    expect(fmtDate(d, 'en')).toBe('12 Nov');
  });
  it('has full, weekday and month-year styles', () => {
    expect(fmtDate(d, 'ar', 'full')).toBe('الخميس ١٢ نوفمبر ٢٠٢٦');
    expect(fmtDate(d, 'en', 'full')).toBe('Thursday, 12 November 2026');
    expect(fmtDate(d, 'en', 'weekday')).toBe('Thu');
    expect(fmtDate(d, 'ar', 'monthYear')).toBe('نوفمبر ٢٠٢٦');
  });
});

describe('relTime', () => {
  const now = new Date(2026, 10, 12, 12, 0).getTime();
  const ago = (secs: number) => now - secs * 1000;

  it('says "now" under a minute', () => {
    expect(relTime(ago(20), 'ar', now)).toBe('الآن');
    expect(relTime(ago(20), 'en', now)).toBe('just now');
  });
  it('uses Arabic counted-noun forms', () => {
    expect(relTime(ago(3600), 'ar', now)).toBe('قبل ساعة');
    expect(relTime(ago(2 * 3600), 'ar', now)).toBe('قبل ساعتين');
    expect(relTime(ago(3 * 3600), 'ar', now)).toBe('قبل ٣ ساعات');
    expect(relTime(ago(11 * 3600), 'ar', now)).toBe('قبل ١١ ساعة');
    expect(relTime(ago(5 * 60), 'ar', now)).toBe('قبل ٥ دقائق');
  });
  it('pluralises English and handles the future', () => {
    expect(relTime(ago(3600), 'en', now)).toBe('1 hour ago');
    expect(relTime(ago(2 * 3600), 'en', now)).toBe('2 hours ago');
    expect(relTime(now + 3 * 86_400_000, 'en', now)).toBe('in 3 days');
    expect(relTime(now + 3 * 86_400_000, 'ar', now)).toBe('بعد ٣ أيام');
  });
  it('never rounds up to the size of the next unit', () => {
    expect(relTime(ago(3599), 'en', now)).toBe('59 minutes ago');
    expect(relTime(ago(86_399), 'en', now)).toBe('23 hours ago');
  });
  it('says yesterday and tomorrow', () => {
    expect(relTime(ago(86_400), 'ar', now)).toBe('أمس');
    expect(relTime(now + 86_400_000, 'en', now)).toBe('tomorrow');
  });
  it('falls back to the date after 30 days', () => {
    expect(relTime(new Date(2026, 8, 1), 'en', now)).toBe('1 Sep');
  });
});
