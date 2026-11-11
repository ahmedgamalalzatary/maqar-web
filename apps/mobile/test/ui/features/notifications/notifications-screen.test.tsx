import type { NotificationItem, NotificationsResponse } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { NotificationsScreen } from '@/features/notifications/screens/notifications-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const HOUR = 3_600_000;
const item = (over: Partial<NotificationItem>): NotificationItem => ({
  id: 1,
  kind: 'price',
  titleAr: 'السعر نزل ٦٪',
  titleEn: 'Price dropped 6%',
  bodyAr: 'شاليه في أزور باي بقى ١١٫٢ مليون',
  bodyEn: 'A chalet in Azure Bay is now EGP 11.2M',
  href: '/property/4',
  read: false,
  createdAt: new Date(Date.now() - 3 * HOUR).toISOString(),
  ...over,
});
const INBOX: NotificationsResponse = {
  items: [
    item({ id: 2 }),
    item({ id: 1, kind: 'match', titleAr: '٣ وحدات جديدة تناسبك', titleEn: '3 new homes match you', bodyEn: 'Picked from your budget', href: '/explore', read: true, createdAt: new Date(Date.now() - 30 * HOUR).toISOString() }),
  ],
  unread: 1,
};

/** A small inbox server that remembers what was read; returns the calls as "METHOD /path". */
function serve(start: NotificationsResponse | 'error') {
  let items = start === 'error' ? [] : start.items.map((n) => ({ ...n }));
  const read = (match: (n: NotificationItem) => boolean) => {
    items = items.map((n) => (match(n) ? { ...n, read: true } : n));
  };
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '');
    if (path === '/notifications') {
      if (start === 'error') return jsonResponse(500, { message: 'down' });
      return jsonResponse(200, { items, unread: items.filter((n) => !n.read).length });
    }
    if (path === '/notifications/read-all') read(() => true);
    const one = /^\/notifications\/(\d+)\/read$/.exec(path);
    if (one) read((n) => n.id === Number(one[1]));
    return jsonResponse(204);
  });
  return () => fetchMock.mock.calls.map(([url, init]: [string, RequestInit]) => `${init.method ?? 'GET'} ${url.replace(/^.*\/v1/, '')}`);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

describe('The notifications inbox', () => {
  it('asks a guest to sign in', async () => {
    await renderWithProviders(<NotificationsScreen back />);
    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });

  it('lists the newest first, marks the unread ones, and says how long ago', async () => {
    await useSession.getState().setSession(makeAuth());
    serve(INBOX);
    await renderWithProviders(<NotificationsScreen back />, { lang: 'en' });
    const rows = await screen.findAllByRole('button', { name: /Price dropped|new homes/ });
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual([
      'New: Price dropped 6%. A chalet in Azure Bay is now EGP 11.2M. 3 hours ago',
      '3 new homes match you. Picked from your budget. yesterday',
    ]);
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
  });

  it('keeps an Arabic line that starts with a client’s English name right to left', async () => {
    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    const body = 'Phone Test | شقة مفروشة | الأربعاء ١١ نوفمبر | الساعة ١١:٠٠ ص';
    serve({ items: [item({ id: 9, kind: 'lead', titleAr: 'حجز جديد من التطبيق', bodyAr: body })], unread: 1 });
    await renderWithProviders(<NotificationsScreen back />);
    expect(await screen.findByText(`‏${body}`)).toBeOnTheScreen();
    expect(screen.getByText('حجز جديد من التطبيق')).toBeOnTheScreen();
  });

  it('opens the screen a notification points to, and marks it read', async () => {
    await useSession.getState().setSession(makeAuth());
    const calls = serve(INBOX);
    await renderWithProviders(<NotificationsScreen back />, { lang: 'en' });
    await fireEvent.press(await screen.findByRole('button', { name: /^New: Price dropped/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/property/4');
    expect(calls()).toContain('POST /notifications/2/read');
    expect(screen.queryAllByTestId('unread-dot')).toHaveLength(0);
  });

  it('opens a read one without marking it again', async () => {
    await useSession.getState().setSession(makeAuth());
    const calls = serve(INBOX);
    await renderWithProviders(<NotificationsScreen back />, { lang: 'en' });
    await fireEvent.press(await screen.findByRole('button', { name: /^3 new homes/ }));
    expect(mockRouter.push).toHaveBeenCalledWith('/explore');
    expect(calls().filter((c) => c.startsWith('POST'))).toEqual([]);
  });

  it('marks everything read at once', async () => {
    await useSession.getState().setSession(makeAuth());
    const calls = serve(INBOX);
    await renderWithProviders(<NotificationsScreen back />);
    await fireEvent.press(await screen.findByRole('button', { name: 'علّم الكل مقروء' }));
    expect(calls()).toContain('POST /notifications/read-all');
    // The inbox refreshes after the request; under a loaded test run that takes a moment.
    await waitFor(() => expect(screen.queryAllByTestId('unread-dot')).toHaveLength(0));
    expect(screen.queryByRole('button', { name: 'علّم الكل مقروء' })).toBeNull();
  });

  it('has a designed empty state, and no "mark all read" with nothing unread', async () => {
    await useSession.getState().setSession(makeAuth());
    serve({ items: [], unread: 0 });
    await renderWithProviders(<NotificationsScreen back />);
    expect(await screen.findByText('مفيش تنبيهات')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'علّم الكل مقروء' })).toBeNull();
  });

  it('offers a retry when the inbox cannot load', async () => {
    await useSession.getState().setSession(makeAuth());
    serve('error');
    await renderWithProviders(<NotificationsScreen back />);
    expect(await screen.findByText('معرفناش نجيب التنبيهات')).toBeOnTheScreen();
    serve(INBOX);
    await fireEvent.press(screen.getByRole('button', { name: 'حاول تاني' }));
    expect(await screen.findByRole('button', { name: /^جديد: السعر نزل/ })).toBeOnTheScreen();
  });

  it('has a back button from the bell, but none as the agent’s Alerts tab', async () => {
    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    serve(INBOX);
    const view = await renderWithProviders(<NotificationsScreen back />);
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(mockRouter.back).toHaveBeenCalled();
    await view.rerender(<NotificationsScreen />);
    expect(screen.queryByRole('button', { name: 'رجوع' })).toBeNull();
  });
});
