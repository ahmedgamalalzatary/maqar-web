import { type AdminViewingItem, fmtDate, fmtTime, type SlotsResponse } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastHost } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { AdminViewingsScreen } from '@/features/admin/screens/viewings-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const later = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
const V: AdminViewingItem = {
  id: 40,
  status: 'confirmed',
  date: later(3),
  time: '11:00',
  startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  rescheduledFrom: null,
  property: { id: 1, titleAr: 'فيلا بحمام سباحة', titleEn: 'Pool villa' },
  agent: { id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959' },
  client: { id: 21, name: 'كريم محمود', phone: '+201014124412', email: 'karim@test.maqar' },
  createdAt: new Date().toISOString(),
};
const SLOTS: SlotsResponse = {
  defaultDate: later(4),
  days: [
    { date: later(4), slots: [{ time: '12:00', state: 'free' }, { time: '13:00', state: 'taken' }] },
    { date: later(5), slots: [{ time: '10:00', state: 'closed' }] },
  ],
} as SlotsResponse;

function serve() {
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const [path] = url.replace(/^.*\/v1/, '').split('?');
    const method = init.method ?? 'GET';
    if (method === 'GET' && path === '/admin/viewings') return jsonResponse(200, { items: [V], page: 1, limit: 50, total: 1 });
    if (method === 'GET' && path === '/properties/1/slots') return jsonResponse(200, SLOTS);
    if (method === 'PATCH' && path === '/admin/viewings/40') return jsonResponse(200, { ...V, status: 'rescheduled' });
    return jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
  return () => fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => [`${init?.method ?? 'GET'} ${url.replace(/^.*\/v1/, '')}`, typeof init?.body === 'string' ? JSON.parse(init.body) : undefined]);
}

const withToasts = (ui: React.ReactElement) => (
  <>
    {ui}
    <ToastHost />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'admin' }));
});

it('moves an upcoming viewing to a free hour of the same advisor, with a reason', async () => {
  const requests = serve();
  await renderWithProviders(withToasts(<AdminViewingsScreen />));
  await fireEvent.press(await screen.findByRole('button', { name: 'كريم محمود، فيلا بحمام سباحة' }));
  await fireEvent.press(screen.getByRole('button', { name: 'غيّر الميعاد' }));
  // Only days with a free hour are offered, and only free hours.
  await waitFor(() => expect(requests().some(([r]) => r === 'GET /properties/1/slots?reschedule=40')).toBe(true));
  await fireEvent.press(await screen.findByRole('radio', { name: fmtDate(later(4), 'ar', 'weekday') }));
  // The closed day is not offered, nor the taken hour.
  expect(screen.queryByRole('radio', { name: fmtDate(later(5), 'ar', 'weekday') })).toBeNull();
  expect(screen.queryByRole('radio', { name: fmtTime('13:00', 'ar') })).toBeNull();
  await fireEvent.press(screen.getByRole('radio', { name: fmtTime('12:00', 'ar') }));
  await fireEvent.changeText(screen.getByLabelText('السبب (العميل والمسؤول هيشوفوه)'), 'المالك مسافر');
  await fireEvent.press(screen.getByRole('button', { name: 'احفظ الميعاد الجديد' }));
  expect(await screen.findByText('الميعاد اتغير')).toBeOnTheScreen();
  expect(requests().find(([r]) => r === 'PATCH /admin/viewings/40')![1]).toEqual({ action: 'reschedule', date: later(4), time: '12:00', reason: 'المالك مسافر' });
});

it('cancels an upcoming viewing', async () => {
  const requests = serve();
  await renderWithProviders(withToasts(<AdminViewingsScreen />));
  await fireEvent.press(await screen.findByRole('button', { name: 'كريم محمود، فيلا بحمام سباحة' }));
  await fireEvent.press(screen.getByRole('button', { name: 'الغي المعاينة' }));
  await fireEvent.press(screen.getByRole('button', { name: 'أكّد الإلغاء' }));
  expect(await screen.findByText('المعاينة اتلغت')).toBeOnTheScreen();
  expect(requests().find(([r]) => r === 'PATCH /admin/viewings/40')![1]).toEqual({ action: 'cancel' });
});
