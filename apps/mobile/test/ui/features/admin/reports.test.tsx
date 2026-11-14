import { cairoToday, reportPresetRange, type ReportResult } from '@maqar/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { useSession } from '@/features/auth/store/session.store';
import { ReportScreen, ReportsScreen } from '@/features/admin/screens/reports-screen';
import { AREAS, makeAuth, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => undefined) }));
const written: string[] = [];
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  File: jest.fn().mockImplementation((_dir: string, name: string) => ({
    uri: `file:///cache/${name}`,
    exists: false,
    create: jest.fn(),
    delete: jest.fn(),
    write: (text: string) => written.push(text),
  })),
}));

const AGENTS = [{ id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959', active: true }];

/** The advisors report, and one advisor's own report (phase 29); the same shape serves both. */
const advisors = (id: 'advisors' | 'advisor') => (q: URLSearchParams): ReportResult => ({
  id,
  generatedAt: '2026-11-12T10:00:00.000Z',
  range: { from: q.get('from')!, to: q.get('to')!, days: 30 },
  previous: { from: '2026-09-14', to: '2026-10-13' },
  kpis: [{ key: 'won', label: { ar: 'اتقفلوا بيع', en: 'Won' }, format: 'int', value: q.get('agentId') === '4' ? 5 : 8, previous: 6, better: 'up' }],
  charts: [],
  tables: [
    {
      key: 'advisors',
      title: { ar: 'المسؤولين', en: 'Advisors' },
      columns: [
        { key: 'advisor', label: { ar: 'المسؤول', en: 'Advisor' }, format: 'text' },
        { key: 'team', label: { ar: 'الفريق', en: 'Team' }, format: 'text' },
        { key: 'won', label: { ar: 'اتقفل بيع', en: 'Won' }, format: 'int' },
      ],
      rows: [
        { cells: { advisor: { ar: 'عمر حسن', en: 'Omar Hassan' }, team: { ar: 'القاهرة', en: 'Cairo' }, won: 2 }, link: { kind: 'agent', id: 3 } },
        { cells: { advisor: { ar: 'مريم عادل', en: 'Mariam Adel' }, team: { ar: 'القاهرة', en: 'Cairo' }, won: 5 }, link: { kind: 'agent', id: 4 } },
        { cells: { advisor: { ar: 'نادين سمير', en: 'Nadine Samir' }, team: { ar: 'الساحل', en: 'Coast' }, won: 1 }, link: { kind: 'agent', id: 5 } },
      ],
    },
  ],
  notes: [],
});

/** A deals report as the API sends it; its numbers say which range was asked. */
const deals = (q: URLSearchParams): ReportResult => ({
  id: 'deals',
  generatedAt: '2026-11-12T10:00:00.000Z',
  range: { from: q.get('from')!, to: q.get('to')!, days: 30 },
  previous: { from: '2026-09-14', to: '2026-10-13' },
  kpis: [
    { key: 'deals', label: { ar: 'صفقات اتقفلت', en: 'Deals closed' }, format: 'int', value: q.get('agentId') ? 1 : 4, previous: 2, better: 'up' },
    { key: 'daysOnMarket', label: { ar: 'متوسط الأيام في السوق', en: 'Average days on the market' }, format: 'days', value: 40, previous: 30, better: 'down' },
  ],
  charts: [{ kind: 'bars', key: 'byArea', title: { ar: 'الصفقات حسب المنطقة', en: 'Deals by area' }, format: 'int', bars: [{ label: { ar: 'التجمع', en: 'New Cairo' }, value: 3 }] }],
  tables: [
    {
      key: 'deals',
      title: { ar: 'الصفقات', en: 'Deals' },
      columns: [
        { key: 'listing', label: { ar: 'العقار', en: 'Listing' }, format: 'text' },
        { key: 'price', label: { ar: 'سعر العرض', en: 'Asking price' }, format: 'money' },
      ],
      rows: Array.from({ length: 30 }, (_, i) => ({ cells: { listing: { ar: `شقة ${i + 1}`, en: `Flat ${i + 1}` }, price: 1_000_000 + i }, link: { kind: 'listing' as const, id: 100 + i } })),
    },
  ],
  notes: [{ ar: 'السعر هو سعر العرض.', en: 'Prices are asking prices.' }],
});

function serve() {
  return routeFetch({
    '/admin/analytics/deals': deals,
    '/admin/analytics/advisors': advisors('advisors'),
    '/admin/analytics/advisor': advisors('advisor'),
    '/admin/agents': () => AGENTS,
    '/areas': () => AREAS,
  });
}
const reportCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.map(([url]: [string]) => url).filter((u) => u.includes('/admin/analytics/')).map((u) => Object.fromEntries(new URLSearchParams(u.split('?')[1])));

beforeEach(async () => {
  jest.clearAllMocks();
  written.length = 0;
  await useSession.getState().setSession(makeAuth({ role: 'admin' }));
});

it('lists the reports by group and opens one', async () => {
  serve();
  await renderWithProviders(<ReportsScreen />);
  expect(screen.getByText('المبيعات')).toBeOnTheScreen();
  expect(screen.getByText('التشغيل')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'الشات وسرعة الرد' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/report/chats');
});

it('asks for the last 30 days, then the chosen range and advisor; shows totals against the period before', async () => {
  const fetchMock = serve();
  await renderWithProviders(<ReportScreen id="deals" />);
  expect(await screen.findByLabelText('صفقات اتقفلت: ٤، قبلها: ٢ (١٠٠٪)')).toBeOnTheScreen();
  // Fewer days on the market is better: up is shown as worse.
  expect(screen.getByLabelText('متوسط الأيام في السوق: ٤٠ يوم، قبلها: ٣٠ يوم (٣٣٪)')).toBeOnTheScreen();
  expect(reportCalls(fetchMock)[0]).toEqual(reportPresetRange('30d', cairoToday()));

  await fireEvent.press(screen.getByRole('radio', { name: 'الشهر اللي فات' }));
  await waitFor(() => expect(reportCalls(fetchMock).at(-1)).toEqual(reportPresetRange('lastMonth', cairoToday())));

  await fireEvent.press(screen.getByRole('button', { name: 'المسؤول: الكل' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'عمر حسن' }));
  await waitFor(() => expect(reportCalls(fetchMock).at(-1)).toMatchObject({ agentId: '3' }));
  expect(await screen.findByLabelText('صفقات اتقفلت: ١، قبلها: ٢ (٥٠٪-)')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'المسؤول: عمر حسن' })).toBeOnTheScreen();
});

it('shows rows as cards that open the listing, 25 at a time, and shares a table as CSV', async () => {
  serve();
  await renderWithProviders(<ReportScreen id="deals" />);
  expect(await screen.findAllByTestId('report-row')).toHaveLength(25);
  await fireEvent.press(screen.getByRole('button', { name: 'اعرض الكل (٣٠)' }));
  expect(screen.getAllByTestId('report-row')).toHaveLength(30);
  const first = screen.getAllByTestId('report-row')[0]!;
  expect(within(first).getByText('١٬٠٠٠٬٠٠٠ ج.م')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('link', { name: 'شقة 1' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/listing/100');

  await fireEvent.press(screen.getByRole('button', { name: 'شارك الصفقات كملف CSV' }));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalled());
  const [uri, opts] = jest.mocked(Sharing.shareAsync).mock.calls[0]!;
  expect(uri).toMatch(/^file:\/\/\/cache\/maqar-deals-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.csv$/);
  expect(opts).toMatchObject({ mimeType: 'text/csv' });
  expect(written[0]!.split('\r\n')[0]).toBe('﻿العقار,سعر العرض (ج.م)');
  expect(written[0]!.split('\r\n')).toHaveLength(31);
});

// Phase 29: every table can be searched, filtered and sorted; an advisor's row opens their own report.
describe('inside a table', () => {
  const names = () => screen.getAllByTestId('report-row').map((row) => within(row).getAllByText(/./)[0]!.props.children as string);

  it('searches in either language', async () => {
    serve();
    await renderWithProviders(<ReportScreen id="advisors" />);
    expect(await screen.findAllByTestId('report-row')).toHaveLength(3);
    await fireEvent.changeText(screen.getByLabelText('ابحث في المسؤولين'), 'mariam');
    expect(names()).toEqual(['مريم عادل']);
    await fireEvent.changeText(screen.getByLabelText('ابحث في المسؤولين'), 'مفيش حد');
    expect(screen.queryAllByTestId('report-row')).toHaveLength(0);
    expect(screen.getByText('مفيش حاجة مطابقة للبحث والفلاتر')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'امسح البحث' }));
    expect(names()).toHaveLength(3);
  });

  it('filters by a column whose values repeat, and sorts by any column', async () => {
    serve();
    await renderWithProviders(<ReportScreen id="advisors" />);
    await screen.findAllByTestId('report-row');
    await fireEvent.press(screen.getByRole('button', { name: 'الفريق: الكل' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الساحل' }));
    expect(names()).toEqual(['نادين سمير']);
    await fireEvent.press(screen.getByRole('button', { name: 'الفريق: الساحل' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الكل' }));

    await fireEvent.press(screen.getByRole('button', { name: 'الترتيب: زي ما هو' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'اتقفل بيع: الأكبر الأول' }));
    expect(names()).toEqual(['مريم عادل', 'عمر حسن', 'نادين سمير']);
    await fireEvent.press(screen.getByRole('button', { name: 'الترتيب: اتقفل بيع، الأكبر الأول' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'المسؤول: من الأول للآخر' }));
    expect(names()).toEqual(['عمر حسن', 'مريم عادل', 'نادين سمير']);
  });

  // Phase 29 review: a range with one row left must not hide the search that is still applied.
  it('keeps the search while it is applied, even when the new range has one row', async () => {
    const lastMonth = reportPresetRange('lastMonth', cairoToday()).from;
    routeFetch({
      '/admin/analytics/advisors': (q: URLSearchParams) => {
        const r = advisors('advisors')(q);
        if (q.get('from') !== lastMonth) return r;
        return { ...r, tables: r.tables.map((tb) => ({ ...tb, rows: tb.rows.slice(0, 1) })) };
      },
      '/admin/agents': () => AGENTS,
      '/areas': () => AREAS,
    });
    await renderWithProviders(<ReportScreen id="advisors" />);
    await screen.findAllByTestId('report-row');
    await fireEvent.changeText(screen.getByLabelText('ابحث في المسؤولين'), 'mariam');
    await fireEvent.press(screen.getByRole('radio', { name: 'الشهر اللي فات' }));
    expect(await screen.findByText('مفيش حاجة مطابقة للبحث والفلاتر')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'امسح البحث' }));
    expect(names()).toEqual(['عمر حسن']);
  });

  it('an advisor’s row opens that advisor’s own report, which asks for them by id and is named after them', async () => {
    const fetchMock = serve();
    const { unmount } = await renderWithProviders(<ReportScreen id="advisors" />);
    await fireEvent.press(await screen.findByRole('link', { name: 'مريم عادل' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin/report/advisor?agentId=4');
    await unmount();

    await renderWithProviders(<ReportScreen id="advisor" agentId={3} />);
    expect(await screen.findByRole('header', { name: 'عمر حسن' })).toBeOnTheScreen();
    await waitFor(() => expect(reportCalls(fetchMock).at(-1)).toMatchObject({ agentId: '3' }));
  });

  it('keeps one advisor’s report out of the list of reports', async () => {
    serve();
    await renderWithProviders(<ReportsScreen />);
    expect(screen.getByRole('button', { name: 'أداء المسؤولين' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'مسؤول واحد' })).toBeNull();
  });
});
