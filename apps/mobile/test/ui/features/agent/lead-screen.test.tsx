import type { LeadDetail } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { ToastHost } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { LeadScreen } from '@/features/agent/screens/lead-screen';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';
import { detailOf } from './fixtures';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

/** A stateful fake API: the lead changes as the screen changes it. Returns the writes. */
function serve(start: LeadDetail = detailOf(), fail = false) {
  let current = start;
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '');
    const method = init.method ?? 'GET';
    if (path === '/agent/leads/1' && method === 'GET') return jsonResponse(200, current);
    if (fail) return jsonResponse(500, { statusCode: 500, message: 'Down' });
    if (path === '/agent/leads/1' && method === 'PATCH') {
      current = { ...current, ...JSON.parse(init.body as string) };
      return jsonResponse(200, current);
    }
    if (path === '/agent/leads/1/notes') {
      const note = { id: 99, text: JSON.parse(init.body as string).text, createdAt: new Date().toISOString() };
      current = { ...current, notes: [note, ...current.notes] };
      return jsonResponse(201, note);
    }
    return jsonResponse(200, { items: [], unread: 0 });
  });
  return () =>
    fetchMock.mock.calls
      .filter(([, init]: [string, RequestInit]) => init.method && init.method !== 'GET')
      .map(([url, init]: [string, RequestInit]) => [init.method, url.replace(/^.*\/v1/, ''), JSON.parse(init.body as string)]);
}

const Page = () => (
  <>
    <LeadScreen id={1} />
    <ToastHost />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'agent' }));
});

describe('Lead page', () => {
  it('shows the client with the full phone, the home, the viewing and the notes', async () => {
    serve();
    await renderWithProviders(<Page />);
    expect(await screen.findByRole('header', { name: 'كريم محمود' })).toBeOnTheScreen();
    expect(screen.getByText('حجز من التطبيق')).toBeOnTheScreen();
    // Left-to-right marks keep the + in front inside an Arabic line.
    expect(screen.getByText('‎+201014124412‎')).toBeOnTheScreen();
    expect(screen.getByText('جديد من التطبيق')).toBeOnTheScreen();
    expect(screen.getByRole('switch', { name: 'عميل مهم', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'معاينة', checked: true })).toBeOnTheScreen();
    expect(screen.getByText('الخميس ١٢ نوفمبر')).toBeOnTheScreen();
    expect(screen.getByText('عايز دور أرضي')).toBeOnTheScreen();
  });

  it('calls and opens WhatsApp on the full number', async () => {
    serve();
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: 'اتصال' }));
    expect(open).toHaveBeenCalledWith('tel:+201014124412');
    await fireEvent.press(screen.getByRole('button', { name: 'واتساب' }));
    expect(open).toHaveBeenCalledWith('https://wa.me/201014124412');
  });

  it('moves the stage, marks it lost and back, and switches hot off', async () => {
    const writes = serve();
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'تفاوض' }));
    expect(await screen.findByRole('radio', { name: 'تفاوض', checked: true })).toBeOnTheScreen();
    expect(await screen.findByText('الحالة: تفاوض')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'علّم كمغلق' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'العميل مغلق، رجّعه جديد' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'عميل مهم' }));
    await waitFor(() =>
      expect(writes()).toEqual([
        ['PATCH', '/agent/leads/1', { stage: 'negotiation' }],
        ['PATCH', '/agent/leads/1', { stage: 'lost' }],
        ['PATCH', '/agent/leads/1', { stage: 'new' }],
        ['PATCH', '/agent/leads/1', { hot: false }],
      ]),
    );
    expect(screen.getByRole('switch', { name: 'عميل مهم', checked: false })).toBeOnTheScreen();
  });

  it('goes back to how it was when a change fails', async () => {
    serve(detailOf(), true);
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'تم البيع' }));
    expect(await screen.findByText('مقدرناش نحفظ التغيير، حاول تاني')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'معاينة', checked: true })).toBeOnTheScreen();
  });

  it('adds a note on top, and does not send an empty one', async () => {
    const writes = serve();
    await renderWithProviders(<Page />);
    const save = await screen.findByRole('button', { name: 'احفظ الملاحظة' });
    expect(save).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('ملاحظة جديدة'), '  اتصلت، هيرد الأحد  ');
    await fireEvent.press(save);
    expect(await screen.findByText('اتصلت، هيرد الأحد')).toBeOnTheScreen();
    expect(writes()).toEqual([['POST', '/agent/leads/1/notes', { text: 'اتصلت، هيرد الأحد' }]]);
    expect(screen.getByLabelText('ملاحظة جديدة')).toHaveProp('value', '');
  });

  it('opens the conversation with the client instead of WhatsApp when there is one', async () => {
    serve(detailOf({ chatId: 12 }));
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: 'الشات' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/agent/chat/12');
    expect(screen.queryByRole('button', { name: 'واتساب' })).toBeNull();
  });

  it('has no call buttons without a number, and names a deleted account', async () => {
    serve(detailOf({ name: '', phone: null }));
    await renderWithProviders(<Page />);
    expect(await screen.findByRole('header', { name: 'حساب محذوف' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'اتصال' })).toBeNull();
    expect(screen.getByText('من غير رقم')).toBeOnTheScreen();
  });
});
