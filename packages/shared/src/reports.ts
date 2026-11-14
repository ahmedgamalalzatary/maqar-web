import type { ChatReportReason } from './api.js';
import type { ReportOutcome } from './admin-activity.js';
import type { Category, Lang, ViewingCanceller, ViewingStatus } from './enums.js';
import { fmtDate, fmtMoney, fmtNum, fmtPct, localDigits, pick } from './format.js';
import type { Bi } from './labels.js';

// ---- Admin reports (phase 27, contract §11) ----
// Every report answers with the same shape (totals, charts, tables), so the app and the web show
// and export any of them the same way. Ranges are Cairo days, both ends included.

export const REPORT_IDS = ['deals', 'advisors', 'advisor', 'leads', 'inventory', 'listings', 'prices', 'quality', 'clients', 'areas', 'viewings', 'chats'] as const;
export type ReportId = (typeof REPORT_IDS)[number];

export const REPORT_GROUPS = ['sales', 'listings', 'clients', 'operations'] as const;
export type ReportGroup = (typeof REPORT_GROUPS)[number];

export const REPORT_GROUP_LABEL: Record<ReportGroup, Bi> = {
  sales: { ar: 'المبيعات', en: 'Sales' },
  listings: { ar: 'العقارات', en: 'Listings' },
  clients: { ar: 'العملاء والطلب', en: 'Clients and demand' },
  operations: { ar: 'التشغيل', en: 'Operations' },
};

/** What a report can be narrowed by. */
export type ReportFilter = 'agent' | 'area' | 'category';

export type ReportSpec = {
  id: ReportId;
  group: ReportGroup;
  title: Bi;
  description: Bi;
  /** False for a snapshot of now (no range, no previous period). */
  ranged: boolean;
  filters: ReportFilter[];
  /** A report about one advisor: it needs `agentId`, and is opened from the advisors report, not the list. */
  needsAgent?: boolean;
};

const ALL: ReportFilter[] = ['agent', 'area', 'category'];

export const REPORTS: ReportSpec[] = [
  {
    id: 'deals',
    group: 'sales',
    title: { ar: 'الصفقات المقفولة', en: 'Closed deals' },
    description: { ar: 'اللي اتباع أو اتأجر، بسعره ومع مين وبعد قد إيه من النشر', en: 'What sold or rented, at which asking price, with whom and how long after publishing' },
    ranged: true,
    filters: ALL,
  },
  {
    id: 'advisors',
    group: 'sales',
    title: { ar: 'أداء المسؤولين', en: 'Advisor performance' },
    description: { ar: 'لكل مسؤول: العملاء والمعاينات والصفقات والتحويل والهدف وسرعة الرد', en: 'Per advisor: leads, viewings, wins, conversion, target and reply time' },
    ranged: true,
    filters: [],
  },
  {
    id: 'advisor',
    group: 'sales',
    title: { ar: 'مسؤول واحد', en: 'One advisor' },
    description: { ar: 'أرقام مسؤول واحد: عملاؤه وصفقاته ومعايناته وشاتاته وعقاراته', en: 'One advisor’s numbers: their leads, deals, viewings, chats and listings' },
    ranged: true,
    filters: [],
    needsAgent: true,
  },
  {
    id: 'leads',
    group: 'sales',
    title: { ar: 'العملاء المحتملين ومصادرهم', en: 'Leads and sources' },
    description: { ar: 'جايين منين وبيتحولوا لإيه، والمراحل، والعملاء الواقفين', en: 'Where leads come from, what they turn into, the pipeline and stalled leads' },
    ranged: true,
    filters: ALL,
  },
  {
    id: 'inventory',
    group: 'listings',
    title: { ar: 'المخزون', en: 'Inventory' },
    description: { ar: 'العقارات دلوقتي: بالحالة والنوع والمنطقة والسعر، ومنشورة من قد إيه', en: 'Listings now: by status, type, area and price, and how long they have been live' },
    ranged: false,
    filters: ALL,
  },
  {
    id: 'listings',
    group: 'listings',
    title: { ar: 'أداء العقارات', en: 'Listing performance' },
    description: { ar: 'لكل عقار: المشاهدات والحفظ والشات والمعاينات، والأحسن واللي محدش سأل عليه', en: 'Per listing: views, saves, chats and viewings; the best and the ones nobody asked about' },
    ranged: true,
    filters: ALL,
  },
  {
    id: 'prices',
    group: 'listings',
    title: { ar: 'تغييرات الأسعار', en: 'Price changes' },
    description: { ar: 'كل تغيير سعر، مين عمله، وكام عميل متابع السعر', en: 'Every price change, who made it, and how many clients follow the price' },
    ranged: true,
    filters: ALL,
  },
  {
    id: 'quality',
    group: 'listings',
    title: { ar: 'جودة العقارات', en: 'Listing quality' },
    description: { ar: 'اللي ناقص كل عقار: صور، مكان، وصف، جولة، فيديو، رقم المالك', en: 'What each listing lacks: photos, a map pin, descriptions, a tour, a video, the owner’s phone' },
    ranged: false,
    filters: ALL,
  },
  {
    id: 'clients',
    group: 'clients',
    title: { ar: 'العملاء والتفاعل', en: 'Clients and engagement' },
    description: { ar: 'التسجيلات والعملاء النشطين وعملوا إيه، والموبايلات واللغة', en: 'Sign-ups, active clients and what they did, phones and languages' },
    ranged: true,
    filters: [],
  },
  {
    id: 'areas',
    group: 'clients',
    title: { ar: 'الطلب حسب المنطقة', en: 'Demand by area' },
    description: { ar: 'لكل منطقة: المعروض والمشاهدات والعملاء والصفقات والميزانيات', en: 'Per area: supply, views, leads, deals, and the budgets of clients who want it' },
    ranged: true,
    filters: ['category'],
  },
  {
    id: 'viewings',
    group: 'operations',
    title: { ar: 'المعاينات', en: 'Viewings' },
    description: { ar: 'اللي اتحجز واتعمل واتلغى ومين لغاه، وأكتر الأيام والساعات', en: 'Booked, done and cancelled (and by whom), and the busiest days and hours' },
    ranged: true,
    filters: ALL,
  },
  {
    id: 'chats',
    group: 'operations',
    title: { ar: 'الشات وسرعة الرد', en: 'Chats and response times' },
    description: { ar: 'المحادثات، أول رد بياخد قد إيه، اللي مستني رد، والبلاغات', en: 'Conversations, time to first reply, who is waiting, and reports' },
    ranged: true,
    filters: ['agent'],
  },
];

export const reportSpec = (id: ReportId): ReportSpec => REPORTS.find((r) => r.id === id)!;

// ---- Ranges ----

/** The most days one report covers. */
export const REPORT_MAX_DAYS = 366;

export const REPORT_PRESETS = ['7d', '30d', '90d', 'month', 'lastMonth', 'year'] as const;
export type ReportPreset = (typeof REPORT_PRESETS)[number];

export const REPORT_PRESET_LABEL: Record<ReportPreset, Bi> = {
  '7d': { ar: 'آخر ٧ أيام', en: 'Last 7 days' },
  '30d': { ar: 'آخر ٣٠ يوم', en: 'Last 30 days' },
  '90d': { ar: 'آخر ٩٠ يوم', en: 'Last 90 days' },
  month: { ar: 'الشهر ده', en: 'This month' },
  lastMonth: { ar: 'الشهر اللي فات', en: 'Last month' },
  year: { ar: 'السنة دي', en: 'This year' },
};

export type DayRange = { from: string; to: string };

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const utc = (date: string) => {
  const [, y, m, d] = DAY.exec(date)!.map(Number) as [number, number, number, number];
  return Date.UTC(y, m - 1, d);
};
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (date: string, n: number) => iso(utc(date) + n * 86_400_000);
const isDay = (s: string) => {
  const m = DAY.exec(s);
  return !!m && iso(utc(s)) === s;
};

/** Today's date in Cairo, where every report day is counted. */
export function cairoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** A preset as dates, given today's Cairo date. */
export function reportPresetRange(preset: ReportPreset, today: string): DayRange {
  const [y, m] = today.split('-').map(Number) as [number, number];
  switch (preset) {
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case '90d':
      return { from: addDays(today, -89), to: today };
    case 'month':
      return { from: `${today.slice(0, 8)}01`, to: today };
    case 'lastMonth': {
      const first = iso(Date.UTC(y, m - 2, 1));
      return { from: first, to: iso(Date.UTC(y, m - 1, 0)) };
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Why these dates are not a report range, or null when they are. */
export function reportRangeProblem(from: string, to: string, today: string): 'format' | 'order' | 'future' | 'long' | null {
  if (!isDay(from) || !isDay(to)) return 'format';
  if (from > to) return 'order';
  if (to > today) return 'future';
  if (rangeDays(from, to) > REPORT_MAX_DAYS) return 'long';
  return null;
}

/** How many days a range covers, both ends included. */
export const rangeDays = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / 86_400_000) + 1;

/** The period of the same length that ends the day before `from`. */
export function previousRange(from: string, to: string): DayRange {
  const n = rangeDays(from, to);
  return { from: addDays(from, -n), to: addDays(from, -1) };
}

/** Every day of a range, in order. */
export function daysOf(from: string, to: string): string[] {
  return Array.from({ length: rangeDays(from, to) }, (_, i) => addDays(from, i));
}

/** `GET /admin/analytics/:id`: a range (left out: the last 30 days) and the filters the report takes. */
export type ReportQuery = { from?: string; to?: string; agentId?: number; areaId?: string; category?: Category };

// ---- The answer ----

/** How a value is shown: `pct` is a fraction (0.5 is 50%), `minutes` and `days` are lengths of time, `date` is YYYY-MM-DD. */
export type CellFormat = 'int' | 'decimal' | 'money' | 'pct' | 'date' | 'days' | 'minutes' | 'text';

export type ReportCell = number | string | Bi | null;

export type ReportColumn = { key: string; label: Bi; format: CellFormat };

/** Where a row leads in the admin tools. */
export type ReportLink = { kind: 'listing' | 'agent' | 'client' | 'chat'; id: number };

export type ReportRow = { cells: Record<string, ReportCell>; link?: ReportLink };

export type ReportTable = { key: string; title: Bi; columns: ReportColumn[]; rows: ReportRow[]; note?: Bi };

/** A total. `previous` is the same total over the previous period (ranged reports). `better` says which way is good. */
export type ReportKpi = { key: string; label: Bi; value: number | null; previous?: number | null; format: CellFormat; better?: 'up' | 'down' };

export type ReportChart =
  | { kind: 'daily'; key: string; title: Bi; format: CellFormat; points: { date: string; value: number }[] }
  | { kind: 'bars'; key: string; title: Bi; format: CellFormat; bars: { label: Bi; value: number; colour?: string }[] }
  /** Rows are weekdays (0 is Sunday), columns are the hours listed; each value is a count. */
  | { kind: 'heatmap'; key: string; title: Bi; hours: number[]; weekdays: number[]; values: number[][] };

export type ReportResult = {
  id: ReportId;
  /** When it was made (ISO). */
  generatedAt: string;
  range: (DayRange & { days: number }) | null;
  previous: DayRange | null;
  kpis: ReportKpi[];
  charts: ReportChart[];
  tables: ReportTable[];
  /** What the numbers do and do not include. */
  notes: Bi[];
};

// ---- Showing and exporting ----

const isBi = (v: unknown): v is Bi => typeof v === 'object' && v !== null && 'ar' in v && 'en' in v;

function arDays(n: number): string {
  if (n === 1) return 'يوم';
  if (n === 2) return 'يومين';
  return `${localDigits(String(n), 'ar')} ${n <= 10 ? 'أيام' : 'يوم'}`;
}

/** A length of time in minutes: "42 min", "1 h 35 min", "26 h". */
export function fmtMinutes(min: number, lang: Lang): string {
  if (min < 1) return lang === 'ar' ? 'أقل من دقيقة' : 'under 1 min';
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  const [hu, mu] = lang === 'ar' ? ['س', 'د'] : ['h', 'min'];
  if (!h) return `${fmtNum(m, lang)} ${mu}`;
  return m ? `${fmtNum(h, lang)} ${hu} ${fmtNum(m, lang)} ${mu}` : `${fmtNum(h, lang)} ${hu}`;
}

/** A cell as the tables show it; nothing is a dash. */
export function fmtCell(v: ReportCell, format: CellFormat, lang: Lang): string {
  if (v === null || v === '') return '—';
  if (isBi(v)) return pick(v, lang);
  if (typeof v === 'string') return format === 'date' ? `${fmtDate(v, lang)} ${localDigits(v.slice(0, 4), lang)}` : v;
  switch (format) {
    case 'money':
      return fmtMoney(v, lang, false);
    case 'pct':
      return fmtPct(v * 100, lang, 1);
    case 'decimal':
      return fmtNum(v, lang, 1);
    case 'days': {
      const n = Math.round(v);
      return lang === 'ar' ? arDays(n) : `${fmtNum(n, lang)} ${n === 1 ? 'day' : 'days'}`;
    }
    case 'minutes':
      return fmtMinutes(v, lang);
    default:
      return fmtNum(v, lang, 0);
  }
}

const UNIT: Partial<Record<CellFormat, Bi>> = {
  money: { ar: 'ج.م', en: 'EGP' },
  pct: { ar: '%', en: '%' },
  days: { ar: 'أيام', en: 'days' },
  minutes: { ar: 'دقائق', en: 'minutes' },
};

function csvValue(v: ReportCell, format: CellFormat, lang: Lang): string {
  if (v === null || v === '') return '';
  let text: string;
  if (typeof v === 'number') text = String(format === 'pct' ? Math.round(v * 1000) / 10 : format === 'decimal' || format === 'minutes' ? Math.round(v * 10) / 10 : v);
  else {
    text = isBi(v) ? pick(v, lang) : v;
    // A spreadsheet would run a cell starting like this as a formula.
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  }
  return /[",\r\n]/.test(text) || text.startsWith("'") ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * A table as a CSV file: UTF-8 with a byte-order mark (so spreadsheets read Arabic), headers in
 * the language with the unit, raw numbers (a percentage as 12.5) and ISO dates.
 */
export function reportCsv(table: ReportTable, lang: Lang): string {
  const head = table.columns.map((c) => {
    const unit = UNIT[c.format];
    return csvValue(unit ? `${pick(c.label, lang)} (${pick(unit, lang)})` : pick(c.label, lang), 'text', lang);
  });
  const rows = table.rows.map((r) => table.columns.map((c) => csvValue(r.cells[c.key] ?? null, c.format, lang)).join(','));
  return `﻿${[head.join(','), ...rows].join('\r\n')}`;
}

/** A file name for a table's CSV: `maqar-deals-2026-10-14-2026-11-12.csv`. */
export const reportFileName = (r: Pick<ReportResult, 'id' | 'range'>, table: string): string =>
  `maqar-${r.id}${table === r.id ? '' : `-${table}`}${r.range ? `-${r.range.from}-${r.range.to}` : ''}.csv`;

// ---- Search, filters and sorting inside a table (phase 29) ----

/** What a table shows: the words searched for, one value per filtered column, and the order. */
export type TableView = { q?: string; filters?: Record<string, string>; sort?: { key: string; up: boolean } | null };

export type TableFilter = { key: string; label: Bi; options: { value: string; label: Bi }[] };

/** A cell's value as a filter value: the same in both languages. */
const cellKey = (v: ReportCell | undefined): string => (v === null || v === undefined ? '' : isBi(v) ? v.en : String(v));

/** The most different values a column can have and still get a filter. */
const FILTER_MAX_VALUES = 12;

/** A filter for each text column whose values repeat (a status, a type, an advisor), options in A to Z order. */
export function tableFilters(table: ReportTable): TableFilter[] {
  const out: TableFilter[] = [];
  for (const col of table.columns) {
    if (col.format !== 'text') continue;
    const seen = new Map<string, Bi>();
    for (const r of table.rows) {
      const v = r.cells[col.key];
      if (v === null || v === undefined || v === '' || typeof v === 'number') continue;
      seen.set(cellKey(v), isBi(v) ? v : { ar: v, en: v });
    }
    if (seen.size < 2 || seen.size > FILTER_MAX_VALUES || seen.size >= table.rows.length) continue;
    const options = [...seen].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.en.localeCompare(b.label.en, 'en'));
    out.push({ key: col.key, label: col.label, options });
  }
  return out;
}

const sortValue = (v: ReportCell | undefined, lang: Lang): number | string => (v === null || v === undefined ? '' : isBi(v) ? pick(v, lang) : v);

/** A table's rows after the search (text in either language, any case), the filters and the sort; empty cells sort last. */
export function viewRows(table: ReportTable, view: TableView, lang: Lang): ReportRow[] {
  const words = view.q?.trim().toLowerCase();
  const filters = Object.entries(view.filters ?? {}).filter(([, v]) => v !== '');
  let rows = table.rows;
  if (words || filters.length) {
    rows = rows.filter((r) => {
      if (!filters.every(([key, value]) => cellKey(r.cells[key]) === value)) return false;
      if (!words) return true;
      return table.columns.some((c) => {
        const v = r.cells[c.key];
        if (v === null || v === undefined || typeof v === 'number') return false;
        const text = isBi(v) ? `${v.ar} ${v.en}` : c.format === 'date' ? `${v} ${fmtCell(v, 'date', 'ar')} ${fmtCell(v, 'date', 'en')}` : v;
        return text.toLowerCase().includes(words);
      });
    });
  }
  const sort = view.sort;
  if (!sort) return rows;
  return [...rows].sort((a, b) => {
    const [x, y] = [sortValue(a.cells[sort.key], lang), sortValue(b.cells[sort.key], lang)];
    if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1;
    const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), lang);
    return sort.up ? d : -d;
  });
}

// ---- Labels the reports use ----

export const CHAT_REPORT_REASON_LABEL: Record<ChatReportReason, Bi> = {
  spam: { ar: 'إزعاج أو سبام', en: 'Spam or nuisance' },
  abuse: { ar: 'إساءة', en: 'Abuse' },
  scam: { ar: 'نصب', en: 'Scam' },
  other: { ar: 'حاجة تانية', en: 'Something else' },
};

export const REPORT_OUTCOME_LABEL: Record<ReportOutcome | 'open', Bi> = {
  open: { ar: 'مفتوح', en: 'Open' },
  dismissed: { ar: 'اتقفل من غير إجراء', en: 'Dismissed' },
  blocked: { ar: 'المحادثة اتقفلت', en: 'Conversation closed' },
  suspended: { ar: 'حساب العميل اتوقف', en: 'Client suspended' },
};

export const VIEWING_STATUS_LABEL: Record<ViewingStatus, Bi> = {
  confirmed: { ar: 'مؤكدة', en: 'Confirmed' },
  rescheduled: { ar: 'اتغير ميعادها', en: 'Rescheduled' },
  cancelled: { ar: 'اتلغت', en: 'Cancelled' },
  completed: { ar: 'خلصت', en: 'Completed' },
};

export const VIEWING_CANCELLER_LABEL: Record<ViewingCanceller | 'unknown', Bi> = {
  client: { ar: 'العميل', en: 'The client' },
  agent: { ar: 'المسؤول', en: 'The advisor' },
  admin: { ar: 'الإدارة', en: 'An admin' },
  unknown: { ar: 'مش متسجل', en: 'Not recorded' },
};
