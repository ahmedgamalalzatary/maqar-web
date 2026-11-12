import type { ChatThread } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { ToastHost } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { ConversationScreen } from '@/features/chat/screens/conversation-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { msg, thread } from './fixtures';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

/** A fake API for one conversation that can be reported and closed. Returns the writes. */
function serve(start: ChatThread) {
  let t = start;
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const path = url.replace(/^.*\/v1/, '').split('?')[0]!;
    const method = init.method ?? 'GET';
    if (path === '/chats/1' && method === 'GET') return jsonResponse(200, t);
    if (path === '/chats/1/messages') return jsonResponse(200, { items: [msg('agent', { kind: 'text', text: 'Hello' }, { id: 3 })], hasMore: false });
    if (path === '/chats/1/read') return new Response(null, { status: 204 });
    if (path === '/chats/1/report') return jsonResponse(201, { id: 9, threadId: 1, ...JSON.parse(init.body as string) });
    if (path === '/chats/1/block') {
      t = { ...t, blocked: { at: new Date().toISOString(), by: 'client' } };
      return jsonResponse(201, t);
    }
    return jsonResponse(200, { items: [], unread: 0 });
  });
  return () =>
    fetchMock.mock.calls
      .filter(([, init]: [string, RequestInit]) => init?.method && init.method !== 'GET')
      .map(([url, init]: [string, RequestInit]) => [url.replace(/^.*\/v1/, ''), init.body ? JSON.parse(init.body as string) : null]);
}

const Page = () => (
  <>
    <ConversationScreen id={1} side="client" />
    <ToastHost />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth());
});

it('reports the conversation with a reason and a note', async () => {
  const writes = serve(thread());
  await renderWithProviders(<Page />);
  await fireEvent.press(await screen.findByRole('button', { name: 'خيارات المحادثة' }));
  await fireEvent.press(screen.getByRole('button', { name: 'بلّغ عن المحادثة' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'إزعاج أو سبام' }));
  await fireEvent.changeText(screen.getByLabelText('تفاصيل (اختياري)'), 'Too many messages');
  await fireEvent.press(screen.getByRole('button', { name: 'ابعت البلاغ' }));
  expect(await screen.findByText('البلاغ وصل لفريق مقر')).toBeOnTheScreen();
  expect(writes()).toContainEqual(['/chats/1/report', { reason: 'spam', note: 'Too many messages' }]);
});

it('closes the conversation after a confirmation: the composer gives way to a closed note', async () => {
  const writes = serve(thread());
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => buttons?.find((b) => b.style === 'destructive')?.onPress?.());
  await renderWithProviders(<Page />);
  expect(await screen.findByLabelText('اكتب رسالة')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'خيارات المحادثة' }));
  await fireEvent.press(screen.getByRole('button', { name: 'اقفل المحادثة' }));
  expect(await screen.findByText('انت قفلت المحادثة دي. محدش يقدر يبعت فيها تاني.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('اكتب رسالة')).toBeNull();
  expect(writes()).toContainEqual(['/chats/1/block', null]);
});

it('a conversation closed by the other side shows why, with no composer and no close option', async () => {
  serve(thread({ blocked: { at: new Date().toISOString(), by: 'agent' } }));
  await renderWithProviders(<Page />);
  expect(await screen.findByText('المسؤول قفل المحادثة دي. لو محتاج حاجة كلّم مقر.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('اكتب رسالة')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'خيارات المحادثة' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'بلّغ عن المحادثة' })).toBeOnTheScreen());
  expect(screen.queryByRole('button', { name: 'اقفل المحادثة' })).toBeNull();
});
