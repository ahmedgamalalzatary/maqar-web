import type { AdminChatDetail, AdminChatItem, ChatReport } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ToastHost } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { AdminChatScreen, AdminChatsScreen } from '@/features/admin/screens/chats-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const now = new Date().toISOString();
const CHAT: AdminChatItem = {
  id: 7,
  property: { id: 1, titleAr: 'فيلا بحمام سباحة', titleEn: 'Pool villa' },
  agent: { id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959' },
  client: { id: 21, name: 'كريم محمود', phone: null },
  last: { id: 50, threadId: 7, sender: 'client', body: { kind: 'text', text: 'رد عليا' }, readAt: null, createdAt: now },
  messages: 2,
  blocked: null,
  openReports: 1,
  createdAt: now,
};
const REPORT: ChatReport = { id: 4, threadId: 7, by: 'agent', reporter: { id: 3, name: 'عمر حسن' }, reason: 'abuse', note: 'شتيمة', createdAt: now, resolvedAt: null, outcome: null, resolvedBy: null };

function serve() {
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const [path] = url.replace(/^.*\/v1/, '').split('?');
    const method = init.method ?? 'GET';
    if (method === 'GET' && path === '/admin/chats') return jsonResponse(200, { items: [CHAT], page: 1, limit: 50, total: 1 });
    if (method === 'GET' && path === '/admin/chats/7') return jsonResponse(200, { ...CHAT, reports: [REPORT] } satisfies AdminChatDetail);
    if (method === 'GET' && path === '/admin/chats/7/messages')
      return jsonResponse(200, {
        items: [
          { id: 49, threadId: 7, sender: 'agent', body: { kind: 'text', text: 'أهلاً' }, readAt: now, createdAt: now },
          CHAT.last,
        ],
        hasMore: false,
      });
    if (method === 'PATCH' && path === '/admin/reports/4') return jsonResponse(200, { ...REPORT, outcome: JSON.parse(init.body as string).outcome, resolvedAt: now });
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

it('lists the reported conversations first and opens one', async () => {
  const requests = serve();
  await renderWithProviders(<AdminChatsScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'كريم محمود، عمر حسن' }));
  expect(mockRouter.push).toHaveBeenCalledWith('/admin/chat/7');
  expect(requests()[0]![0]).toContain('reported=true');
  await fireEvent.press(screen.getByRole('radio', { name: 'الكل' }));
  await waitFor(() => expect(requests().some(([r]) => r === 'GET /admin/chats?limit=50&page=1')).toBe(true));
});

it('reads the conversation and closes the report: dismissed, or the client suspended after a confirmation', async () => {
  const requests = serve();
  await renderWithProviders(withToasts(<AdminChatScreen id={7} />));
  expect(await screen.findByText('رد عليا')).toBeOnTheScreen();
  expect(screen.getByText('أهلاً')).toBeOnTheScreen();
  expect(screen.getByText('شتيمة')).toBeOnTheScreen();
  // Reading sends nothing.
  expect(requests().filter(([r]) => !r!.startsWith('GET'))).toEqual([]);
  await fireEvent.press(screen.getByRole('button', { name: 'اقفل البلاغ بس' }));
  expect(await screen.findByText('اتقفل من غير إجراء')).toBeOnTheScreen();
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.());
  await fireEvent.press(screen.getByRole('button', { name: 'وقّف حساب العميل' }));
  await waitFor(() => expect(requests().filter(([r]) => r === 'PATCH /admin/reports/4').map(([, b]) => b)).toEqual([{ outcome: 'dismissed' }, { outcome: 'suspended' }]));
});
