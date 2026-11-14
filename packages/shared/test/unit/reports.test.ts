import {
  cairoToday,
  fmtCell,
  fmtMinutes,
  previousRange,
  rangeDays,
  REPORT_IDS,
  REPORTS,
  reportCsv,
  reportPresetRange,
  reportRangeProblem,
  type ReportTable,
} from '../../src/reports.js';

describe('report ranges (phase 27)', () => {
  const today = '2026-11-12';

  it('presets are Cairo days ending today, or whole months', () => {
    expect(reportPresetRange('7d', today)).toEqual({ from: '2026-11-06', to: today });
    expect(reportPresetRange('30d', today)).toEqual({ from: '2026-10-14', to: today });
    expect(reportPresetRange('90d', today)).toEqual({ from: '2026-08-15', to: today });
    expect(reportPresetRange('month', today)).toEqual({ from: '2026-11-01', to: today });
    expect(reportPresetRange('lastMonth', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(reportPresetRange('lastMonth', '2026-03-05')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(reportPresetRange('lastMonth', '2027-01-09')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
    expect(reportPresetRange('year', today)).toEqual({ from: '2026-01-01', to: today });
  });

  it('a range is two real dates in order, not in the future, at most 366 days', () => {
    expect(reportRangeProblem('2026-11-01', '2026-11-12', today)).toBeNull();
    expect(reportRangeProblem('2026-11-12', '2026-11-12', today)).toBeNull();
    expect(reportRangeProblem('2025-11-12', '2026-11-12', today)).toBeNull();
    expect(reportRangeProblem('2025-11-11', '2026-11-12', today)).toBe('long');
    expect(reportRangeProblem('2026-11-13', '2026-11-12', today)).toBe('order');
    expect(reportRangeProblem('2026-11-01', '2026-11-13', today)).toBe('future');
    expect(reportRangeProblem('2026-02-30', '2026-03-02', today)).toBe('format');
    expect(reportRangeProblem('12/11/2026', '2026-11-12', today)).toBe('format');
  });

  it('today is the Cairo date', () => {
    expect(cairoToday(new Date('2026-11-12T21:59:00Z'))).toBe('2026-11-12');
    expect(cairoToday(new Date('2026-11-12T22:01:00Z'))).toBe('2026-11-13');
  });

  it('counts days with both ends, and the previous period has the same length just before', () => {
    expect(rangeDays('2026-11-01', '2026-11-12')).toBe(12);
    expect(rangeDays('2026-11-12', '2026-11-12')).toBe(1);
    expect(previousRange('2026-11-01', '2026-11-12')).toEqual({ from: '2026-10-20', to: '2026-10-31' });
    expect(previousRange('2026-03-01', '2026-03-31')).toEqual({ from: '2026-01-29', to: '2026-02-28' });
  });
});

describe('the report catalogue', () => {
  it('has eleven listed reports (and one per advisor) in four groups, each titled in both languages', () => {
    expect(REPORTS.filter((r) => !r.needsAgent)).toHaveLength(11);
    expect(REPORT_IDS).toHaveLength(12);
    expect(REPORTS.map((r) => r.id)).toEqual([...REPORT_IDS]);
    expect(new Set(REPORTS.map((r) => r.group))).toEqual(new Set(['sales', 'listings', 'clients', 'operations']));
    for (const r of REPORTS) expect(r.title.ar && r.title.en && r.description.ar && r.description.en).toBeTruthy();
    // Snapshots of now have no range.
    expect(REPORTS.filter((r) => !r.ranged).map((r) => r.id)).toEqual(['inventory', 'quality']);
  });
});

describe('report cells', () => {
  it('formats each kind in the language, and shows a dash for nothing', () => {
    expect(fmtCell(1234, 'int', 'en')).toBe('1,234');
    expect(fmtCell(1234, 'int', 'ar')).toBe('١٬٢٣٤');
    expect(fmtCell(7_250_000, 'money', 'en')).toBe('EGP 7,250,000');
    expect(fmtCell(0.456, 'pct', 'en')).toBe('45.6%');
    expect(fmtCell(0.5, 'pct', 'ar')).toBe('٥٠٪');
    expect(fmtCell(2.345, 'decimal', 'en')).toBe('2.3');
    expect(fmtCell('2026-11-12', 'date', 'en')).toBe('12 Nov 2026');
    expect(fmtCell(12, 'days', 'en')).toBe('12 days');
    expect(fmtCell(1, 'days', 'ar')).toBe('يوم');
    expect(fmtCell(95, 'minutes', 'en')).toBe('1 h 35 min');
    expect(fmtCell({ ar: 'زايد', en: 'Zayed' }, 'text', 'ar')).toBe('زايد');
    expect(fmtCell(null, 'money', 'en')).toBe('—');
    expect(fmtMinutes(42, 'en')).toBe('42 min');
    expect(fmtMinutes(0.4, 'en')).toBe('under 1 min');
    expect(fmtMinutes(60 * 26, 'ar')).toBe('٢٦ س');
  });
});

describe('reportCsv', () => {
  const table: ReportTable = {
    key: 'deals',
    title: { ar: 'الصفقات', en: 'Deals' },
    columns: [
      { key: 'title', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
      { key: 'price', label: { ar: 'السعر', en: 'Price' }, format: 'money' },
      { key: 'share', label: { ar: 'النسبة', en: 'Share' }, format: 'pct' },
      { key: 'closed', label: { ar: 'اتقفل', en: 'Closed' }, format: 'date' },
    ],
    rows: [
      { cells: { title: { ar: 'شقة، "حديقة"', en: 'Flat, "garden"' }, price: 7_250_000, share: 0.125, closed: '2026-11-10' }, link: { kind: 'listing', id: 7 } },
      { cells: { title: '=HYPERLINK("x")', price: null, share: null, closed: null } },
    ],
  };

  it('is UTF-8 with a byte-order mark, headers in the language, raw numbers, quoted text', () => {
    const csv = reportCsv(table, 'en');
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe('Listing,Price (EGP),Share (%),Closed');
    expect(lines[1]).toBe('"Flat, ""garden""",7250000,12.5,2026-11-10');
    // A cell a spreadsheet would run as a formula is kept as text.
    expect(lines[2]).toBe(`"'=HYPERLINK(""x"")",,,`);
    expect(reportCsv(table, 'ar').slice(1).split('\r\n')[0]).toBe('العقار,السعر (ج.م),النسبة (%),اتقفل');
  });
});
