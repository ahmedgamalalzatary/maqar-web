import type { ChatMessage, ChatThread, SlotsResponse } from '@maqar/shared';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { AppState, type AppStateStatus, type NativeEventSubscription } from 'react-native';
import { ToastHost } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { ConversationScreen } from '@/features/chat/screens/conversation-screen';
import * as socket from '@/features/chat/socket';
import { heardTyping, useTyping } from '@/features/chat/socket';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';
import { msg, thread } from './fixtures';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const SLOTS: SlotsResponse = {
  days: [
    { date: '2026-11-12', slots: [{ time: '16:00', state: 'taken' }] },
    { date: '2026-11-13', slots: [{ time: '16:00', state: 'free' }, { time: '17:00', state: 'free' }] },
  ],
  defaultDate: '2026-11-13',
};

/** A stateful fake API for one conversation. Returns the writes. */
function serve(t: ChatThread, start: ChatMessage[], opts: { bookStatus?: number } = {}) {
  let items = [...start];
  let next = 900;
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '').split('?')[0]!;
    const method = init.method ?? 'GET';
    if (path === '/chats/1' && method === 'GET') return jsonResponse(200, t);
    if (path === '/chats/1/messages' && method === 'GET') return jsonResponse(200, { items, hasMore: false });
    if (path === '/chats/1/messages' && method === 'POST') {
      const body = JSON.parse(init.body as string);
      const real = msg(t.client ? 'agent' : 'client', body.kind === 'text' ? body : body.kind === 'slots' ? { kind: 'slots', date: body.date, times: ['16:00', '17:00'], chosen: null } : body, { id: ++next });
      items = [...items, real];
      return jsonResponse(201, real);
    }
    if (path === '/chats/1/read') return new Response(null, { status: 204 });
    if (path.endsWith('/book')) {
      if (opts.bookStatus) return jsonResponse(opts.bookStatus, { statusCode: opts.bookStatus, message: 'That time was just booked. Please pick another.' });
      const { time } = JSON.parse(init.body as string);
      const card = items.find((m) => m.body.kind === 'slots')!;
      const picked = { ...card, body: { ...card.body, chosen: time } } as ChatMessage;
      items = items.map((m) => (m.id === card.id ? picked : m));
      // The pick is a request the advisor answers (owner, 2026-11-14).
      items = [...items, msg('client', { kind: 'booking', viewingId: 5, date: '2026-11-13', time, state: 'pending' }, { id: ++next })];
      return jsonResponse(201, { viewing: { id: 5, status: 'pending' }, card: picked });
    }
    if (path.endsWith('/answer')) {
      const body = JSON.parse(init.body as string) as { action: string; date?: string; time?: string };
      const req = items.find((m) => m.body.kind === 'booking' && m.body.state === 'pending')!;
      const state = body.action === 'accept' ? 'accepted' : body.action === 'decline' ? 'declined' : 'moved';
      const marked = { ...req, body: { ...req.body, state } } as ChatMessage;
      const when = req.body as { date: string; time: string };
      items = [
        ...items.map((m) => (m.id === req.id ? marked : m)),
        msg('agent', { kind: 'booking', viewingId: 5, date: body.date ?? when.date, time: body.time ?? when.time, state } as ChatMessage['body'], { id: ++next }),
      ];
      return jsonResponse(201, { viewing: { id: 5 }, card: marked });
    }
    if (path.startsWith('/properties/4/slots')) return jsonResponse(200, SLOTS);
    return jsonResponse(200, { items: [], unread: 0 });
  });
  return () =>
    fetchMock.mock.calls
      .filter(([, init]: [string, RequestInit]) => init.method && init.method !== 'GET')
      .map(([url, init]: [string, RequestInit]) => [url.replace(/^.*\/v1/, ''), init.body ? JSON.parse(init.body as string) : null]);
}

const Page = ({ side = 'client' as const }: { side?: 'client' | 'agent' }) => (
  <>
    <ConversationScreen id={1} side={side} />
    <ToastHost />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  useTyping.setState({}, true);
  await useSession.getState().setSession(makeAuth());
});

describe('Conversation (client)', () => {
  it('shows the advisor, the home, and every kind of message with read ticks', async () => {
    serve(thread(), [
      msg('client', { kind: 'text', text: 'لسه متاحة؟' }, { readAt: new Date().toISOString() }),
      msg('agent', { kind: 'text', text: 'أيوه متاحة' }),
      msg('agent', { kind: 'property' }),
      msg('agent', { kind: 'plan', price: 8_000_000, downPct: 10, years: 8, monthly: 75_000 }),
      msg('agent', { kind: 'booking', viewingId: 5, date: '2026-11-13', time: '16:00' }),
      msg('agent', { kind: 'text', text: 'برّه مواعيد الشغل', auto: true }),
    ]);
    await renderWithProviders(<Page />);
    expect(await screen.findByRole('header', { name: 'عمر حسن' })).toBeOnTheScreen();
    expect(screen.getByText('مستشار مبيعات | هدفنا الرد خلال ٤ د')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'الوحدة: فيلا في التجمع' })).toBeOnTheScreen();
    expect(await screen.findByLabelText('أنت: لسه متاحة؟، اتقرت')).toBeOnTheScreen();
    expect(screen.getByText('القسط الشهري')).toBeOnTheScreen();
    expect(screen.getByText('المعاينة اتأكدت')).toBeOnTheScreen();
    expect(screen.getByText('رد تلقائي')).toBeOnTheScreen();
    expect(screen.getByText('محادثتك مع مسؤول مبيعات موثّق من مقر. متشاركش بيانات الدفع في الشات.')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'معايناتي' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/viewings');
  });

  it('marks the advisor’s messages read when they are on screen', async () => {
    const writes = serve(thread(), [msg('agent', { kind: 'text', text: 'أهلاً' })]);
    await renderWithProviders(<Page />);
    await waitFor(() => expect(writes()).toEqual([['/chats/1/read', null]]));
  });

  it('tries a failed read once, not over and over', async () => {
    serve(thread(), [msg('agent', { kind: 'text', text: 'أهلاً' })]);
    const fetchMock = jest.mocked(global.fetch);
    const base = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url, init) => (String(url).endsWith('/chats/1/read') ? jsonResponse(500, { statusCode: 500, message: 'Down' }) : base(url, init)));
    const reads = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/chats/1/read')).length;
    await renderWithProviders(<Page />);
    await waitFor(() => expect(reads()).toBe(1));
    await act(() => new Promise((r) => setTimeout(r, 300)));
    expect(reads()).toBe(1);
  });

  it('in the background, leaves messages unread and lets the server notify; back in the app, reads them', async () => {
    const changes: ((s: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_e, fn) => {
      changes.push(fn as (s: AppStateStatus) => void);
      return { remove: () => changes.splice(changes.indexOf(fn as (s: AppStateStatus) => void), 1) } as NativeEventSubscription;
    });
    const real = Object.getOwnPropertyDescriptor(AppState, 'currentState')!;
    const setState = (value: AppStateStatus) => Object.defineProperty(AppState, 'currentState', { value, configurable: true });
    setState('background');
    const open = jest.spyOn(socket, 'setOpenThread');
    const writes = serve(thread(), [msg('agent', { kind: 'text', text: 'أهلاً' })]);
    await renderWithProviders(<Page />);
    expect(await screen.findByText('أهلاً')).toBeOnTheScreen();
    expect(open).toHaveBeenLastCalledWith(null);
    expect(writes()).toEqual([]);
    setState('active');
    await act(() => changes.forEach((fn) => fn('active')));
    expect(open).toHaveBeenLastCalledWith(1);
    await waitFor(() => expect(writes()).toEqual([['/chats/1/read', null]]));
    Object.defineProperty(AppState, 'currentState', real);
    jest.restoreAllMocks();
  });

  it('sends a text and a quick question, and the text shows at once', async () => {
    const writes = serve(thread(), []);
    await renderWithProviders(<Page />);
    const send = await screen.findByRole('button', { name: 'ابعت' });
    expect(send).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('اكتب رسالة'), '  عايز أعرف الدور  ');
    await fireEvent.press(send);
    expect(await screen.findByText('عايز أعرف الدور')).toBeOnTheScreen();
    expect(screen.getByLabelText('اكتب رسالة')).toHaveProp('value', '');
    await fireEvent.press(screen.getByRole('button', { name: 'فيه خصم كاش؟' }));
    await waitFor(() =>
      expect(writes()).toEqual([
        ['/chats/1/messages', { kind: 'text', text: 'عايز أعرف الدور' }],
        ['/chats/1/messages', { kind: 'text', text: 'فيه خصم كاش؟' }],
      ]),
    );
    expect(await screen.findByLabelText('أنت: فيه خصم كاش؟، اتبعتت')).toBeOnTheScreen();
  });

  it('books a time from the advisor’s card in one tap; it waits for the advisor to confirm (2026-11-14)', async () => {
    const card = msg('agent', { kind: 'slots', date: '2026-11-13', times: ['16:00', '17:00'], chosen: null });
    const writes = serve(thread(), [card]);
    await renderWithProviders(<Page />);
    expect(await screen.findByText('دوس على ميعاد، والمسؤول هيأكده')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: '٥:٠٠ م' }));
    expect(await screen.findByText('طلبك وصل، مستنيين المسؤول يأكد الميعاد')).toBeOnTheScreen();
    // The request in the chat, with no answer buttons for the client.
    expect(await screen.findByText('حجزت معاينة')).toBeOnTheScreen();
    expect(screen.getByText('مستنية تأكيد المسؤول')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'أكّد المعاينة' })).toBeNull();
    expect(screen.getByRole('button', { name: '٥:٠٠ م، اتحجزت' })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '٤:٠٠ م' })).toBeDisabled();
    expect(writes()).toContainEqual([`/chats/1/messages/${card.id}/book`, { time: '17:00' }]);
  });

  it('offers a retry when the messages fail to load, and when older ones do', async () => {
    let failFirst = true;
    let failOlder = true;
    mockFetch().mockImplementation(async (url: string) => {
      const [path, qs] = url.replace(/^.*\/v1/, '').split('?');
      if (path === '/chats/1') return jsonResponse(200, thread());
      if (path === '/chats/1/messages' && !qs) {
        if (failFirst) return jsonResponse(500, { statusCode: 500, message: 'Server error' });
        return jsonResponse(200, { items: [msg('agent', { kind: 'text', text: 'أحدث رسالة' }, { id: 50 })], hasMore: true });
      }
      if (path === '/chats/1/messages') {
        if (failOlder) return jsonResponse(500, { statusCode: 500, message: 'Server error' });
        return jsonResponse(200, { items: [msg('agent', { kind: 'text', text: 'رسالة قديمة' }, { id: 10 })], hasMore: false });
      }
      return new Response(null, { status: 204 });
    });
    await renderWithProviders(<Page />);

    expect(await screen.findByText('مقدرناش نجيب الرسايل')).toBeOnTheScreen();
    failFirst = false;
    await fireEvent.press(screen.getByRole('button', { name: 'حاول تاني' }));
    expect(await screen.findByText('أحدث رسالة')).toBeOnTheScreen();

    await fireEvent(screen.getByTestId('messages'), 'endReached');
    const retry = await screen.findByRole('button', { name: 'حاول تاني' });
    expect(screen.getByText('مقدرناش نجيب الرسايل القديمة')).toBeOnTheScreen();
    failOlder = false;
    await fireEvent.press(retry);
    expect(await screen.findByText('رسالة قديمة')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'حاول تاني' })).toBeNull();
  });

  it('says when the time was just taken', async () => {
    serve(thread(), [msg('agent', { kind: 'slots', date: '2026-11-13', times: ['16:00'], chosen: null })], { bookStatus: 409 });
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: '٤:٠٠ م' }));
    expect(await screen.findByText('الميعاد ده لسه اتحجز، اختار ميعاد تاني')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '٤:٠٠ م' })).not.toBeDisabled();
  });

  it('shows the other side typing', async () => {
    serve(thread(), []);
    await renderWithProviders(<Page />);
    await screen.findByRole('header', { name: 'عمر حسن' });
    await act(async () => heardTyping(1));
    expect(screen.getAllByText('بيكتب…').length).toBeGreaterThan(0);
  });

  it('sends photos picked on the phone', async () => {
    serve(thread(), []);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: 'file:///a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg', width: 10, height: 10 } as ImagePicker.ImagePickerAsset],
    });
    const fetchMock = jest.mocked(global.fetch);
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: 'ابعت صور' }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, init]) => String(u).endsWith('/chats/1/images') && init?.body instanceof FormData)).toBe(true));
  });
});

describe('Conversation (agent)', () => {
  beforeEach(async () => {
    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
  });

  it('sends the home, plan and tour cards, and a day’s free times', async () => {
    const writes = serve(thread({ client: { name: 'كريم محمود', phone: '+201014124412' }, leadId: 3 }), [msg('client', { kind: 'text', text: 'لسه متاحة؟' })]);
    await renderWithProviders(<Page side="agent" />);
    expect(await screen.findByRole('header', { name: 'كريم محمود' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'فيه خصم كاش؟' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'خطة السداد' }));
    await fireEvent.press(screen.getByRole('button', { name: 'جولة ٣٦٠°' }));
    await fireEvent.press(screen.getByRole('button', { name: 'تفاصيل الوحدة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'مواعيد متاحة' }));
    const day = await screen.findByRole('button', { name: /^الجمعة ١٣ نوفمبر، ٢ ميعاد/ });
    expect(screen.queryByRole('button', { name: /الخميس ١٢ نوفمبر/ })).toBeNull();
    await fireEvent.press(day);
    await waitFor(() =>
      expect(writes().filter(([u]) => u === '/chats/1/messages')).toEqual([
        ['/chats/1/messages', { kind: 'plan' }],
        ['/chats/1/messages', { kind: 'tour' }],
        ['/chats/1/messages', { kind: 'property' }],
        ['/chats/1/messages', { kind: 'slots', date: '2026-11-13' }],
      ]),
    );
    const card = await screen.findByText('الجمعة ١٣ نوفمبر', { exact: true });
    expect(within(card.parent!.parent!).queryByText('دوس على ميعاد، والمسؤول هيأكده')).toBeNull();
  });

  // Owner, 2026-11-14: a time the client picked waits for the advisor, who accepts, declines or moves it.
  describe('a booking request', () => {
    const request = () => msg('client', { kind: 'booking', viewingId: 5, date: '2026-11-13', time: '16:00', state: 'pending' });
    const agentThread = () => thread({ client: { name: 'كريم محمود', phone: '+201014124412' }, leadId: 3 });

    it('shows what the client booked; accepting it confirms, and the buttons go', async () => {
      const req = request();
      const writes = serve(agentThread(), [req]);
      await renderWithProviders(<Page side="agent" />);
      expect(await screen.findByText('العميل حجز معاينة')).toBeOnTheScreen();
      expect(screen.getByText('الجمعة ١٣ نوفمبر | ٤:٠٠ م')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'أكّد المعاينة' }));
      await waitFor(() => expect(writes()).toContainEqual([`/chats/1/messages/${req.id}/answer`, { action: 'accept' }]));
      expect(await screen.findByText('المعاينة اتأكدت للعميل')).toBeOnTheScreen();
      await waitFor(() => expect(screen.queryByRole('button', { name: 'أكّد المعاينة' })).toBeNull());
      expect(screen.getAllByText('المعاينة اتأكدت').length).toBeGreaterThan(0);
    });

    it('declines it', async () => {
      const req = request();
      const writes = serve(agentThread(), [req]);
      await renderWithProviders(<Page side="agent" />);
      await fireEvent.press(await screen.findByRole('button', { name: 'اعتذر' }));
      await waitFor(() => expect(writes()).toContainEqual([`/chats/1/messages/${req.id}/answer`, { action: 'decline' }]));
      expect(await screen.findByText('المسؤول اعتذر عن المعاينة')).toBeOnTheScreen();
    });

    it('moves it to another free hour of the advisor', async () => {
      const req = request();
      const writes = serve(agentThread(), [req]);
      await renderWithProviders(<Page side="agent" />);
      await fireEvent.press(await screen.findByRole('button', { name: 'غيّر الميعاد' }));
      await fireEvent.press(await screen.findByRole('button', { name: /^الجمعة ١٣ نوفمبر/ }));
      await fireEvent.press(await screen.findByRole('button', { name: '٥:٠٠ م' }));
      await waitFor(() =>
        expect(writes()).toContainEqual([`/chats/1/messages/${req.id}/answer`, { action: 'reschedule', date: '2026-11-13', time: '17:00' }]),
      );
      expect(await screen.findByText('الميعاد اتغير')).toBeOnTheScreen();
    });
  });
});
