import type { AdminOverview } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { OverviewScreen } from '@/features/admin/screens/overview-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const overview = (days: 7 | 30 | 90): AdminOverview => ({
  days,
  from: '2026-11-06',
  to: '2026-11-12',
  listings: { byStatus: { draft: 1, approved: 12, unpublished: 0, sold: 2, rented: 1 }, published: 3, closed: 1 },
  clients: { total: 140, new: days === 7 ? 9 : 31 },
  leads: { new: 14, byStage: { new: 6, contacted: 3, viewing: 2, negotiation: 1, won: 1, lost: 1 }, won: 2 },
  viewings: { booked: 11, completed: 4, cancelled: 2, next7Days: 5 },
  chats: { new: 7, messages: 64, openReports: 2 },
  agents: [{ id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959', live: 8, openLeads: 5, viewings: 6, wonThisMonth: 3, monthlyTarget: 6 }],
  daily: ['2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12'].map((date, i) => ({ date, clients: i, leads: 1, viewings: 2 })),
});

function serve() {
  const fetchMock = mockFetch().mockImplementation(async (url: string) => {
    const days = Number(new URL(url).searchParams.get('days')) as 7 | 30 | 90;
    return jsonResponse(200, overview(days));
  });
  return () => fetchMock.mock.calls.map(([url]: [string]) => url.replace(/^.*\/v1/, ''));
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'admin' }));
});

it('shows the numbers for the last 30 days, switches range, and links to the open reports', async () => {
  const requests = serve();
  await renderWithProviders(<OverviewScreen />);
  expect(await screen.findByLabelText('عملاء جداد: ٣١، ١٤٠ عميل في الكل')).toBeOnTheScreen();
  expect(screen.getByLabelText('معاينات اتحجزت: ١١، ٤ خلصت | ٢ اتلغت')).toBeOnTheScreen();
  expect(screen.getByLabelText('اتقفل ٣ من هدف ٦ الشهر ده')).toBeOnTheScreen();
  expect(requests()[0]).toBe('/admin/overview?days=30');

  await fireEvent.press(screen.getByRole('radio', { name: 'آخر ٧ يوم' }));
  expect(await screen.findByLabelText('عملاء جداد: ٩، ١٤٠ عميل في الكل')).toBeOnTheScreen();

  await fireEvent.press(screen.getByRole('button', { name: '٢ بلاغ مفتوح على الشات' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/chats');
});

it('the daily chart shows one metric at a time; tapping a day tells its number', async () => {
  serve();
  await renderWithProviders(<OverviewScreen />);
  await screen.findByText('في اليوم، دوس على يوم');
  // New clients first: 0 to 6 over the week.
  expect(screen.getByRole('button', { name: '١٢ نوفمبر: ٦' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'معاينات اتحجزت' }));
  await fireEvent.press(screen.getByRole('button', { name: '١٢ نوفمبر: ٢' }));
  expect(await screen.findByText('١٢ نوفمبر: ٢')).toBeOnTheScreen();
  await waitFor(() => expect(screen.queryByText('في اليوم، دوس على يوم')).toBeNull());
});
