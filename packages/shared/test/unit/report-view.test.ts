import { type ReportTable, REPORTS, tableFilters, viewRows } from '../../src/reports.js';

const table: ReportTable = {
  key: 'deals',
  title: { ar: 'الصفقات', en: 'Deals' },
  columns: [
    { key: 'home', label: { ar: 'العقار', en: 'Home' }, format: 'text' },
    { key: 'kind', label: { ar: 'النوع', en: 'Kind' }, format: 'text' },
    { key: 'price', label: { ar: 'السعر', en: 'Price' }, format: 'money' },
    { key: 'day', label: { ar: 'اليوم', en: 'Day' }, format: 'date' },
  ],
  rows: [
    { cells: { home: { ar: 'فيلا المعادي', en: 'Maadi villa' }, kind: { ar: 'بيع', en: 'Sale' }, price: 9_000_000, day: '2026-11-02' } },
    { cells: { home: { ar: 'شقة زايد', en: 'Zayed flat' }, kind: { ar: 'إيجار', en: 'Rent' }, price: 30_000, day: '2026-11-05' } },
    { cells: { home: { ar: 'دوبلكس التجمع', en: 'Tagamoa duplex' }, kind: { ar: 'بيع', en: 'Sale' }, price: null, day: '2026-10-20' } },
  ],
};
const homes = (rows: ReportTable['rows']) => rows.map((r) => (r.cells.home as { en: string }).en);

describe('searching, filtering and sorting a report table (phase 29)', () => {
  it('searches the text in both languages, whatever the case', () => {
    expect(homes(viewRows(table, { q: 'VILLA' }, 'ar'))).toEqual(['Maadi villa']);
    expect(homes(viewRows(table, { q: 'زايد' }, 'en'))).toEqual(['Zayed flat']);
    expect(homes(viewRows(table, { q: '  ' }, 'en'))).toHaveLength(3);
    expect(viewRows(table, { q: 'nothing like it' }, 'en')).toEqual([]);
  });

  it('offers a filter for the columns whose values repeat, and applies it', () => {
    const filters = tableFilters(table);
    expect(filters.map((f) => f.key)).toEqual(['kind']);
    expect(filters[0]!.options.map((o) => o.label.en)).toEqual(['Rent', 'Sale']);
    expect(homes(viewRows(table, { filters: { kind: filters[0]!.options[1]!.value } }, 'en'))).toEqual(['Maadi villa', 'Tagamoa duplex']);
  });

  it('sorts by number, date or text, with empty cells last either way', () => {
    expect(homes(viewRows(table, { sort: { key: 'price', up: false } }, 'en'))).toEqual(['Maadi villa', 'Zayed flat', 'Tagamoa duplex']);
    expect(homes(viewRows(table, { sort: { key: 'price', up: true } }, 'en'))).toEqual(['Zayed flat', 'Maadi villa', 'Tagamoa duplex']);
    expect(homes(viewRows(table, { sort: { key: 'day', up: true } }, 'en'))).toEqual(['Tagamoa duplex', 'Maadi villa', 'Zayed flat']);
    expect(homes(viewRows(table, { sort: { key: 'home', up: true } }, 'en'))).toEqual(['Maadi villa', 'Tagamoa duplex', 'Zayed flat']);
  });

  it('has one advisor’s own report, opened from the advisors report and not listed with the others', () => {
    const one = REPORTS.find((r) => r.id === 'advisor')!;
    expect(one.needsAgent).toBe(true);
    expect(one.ranged).toBe(true);
  });
});
