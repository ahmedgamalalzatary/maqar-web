import type { PropertyDetail, SlotDay, SlotsResponse, ViewingItem } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ToastHost } from '@/components/toast';
import { useAuthPrompt } from '@/features/auth/components/auth-prompt';
import { useSession } from '@/features/auth/store/session.store';
import { BookScreen } from '@/features/viewings/screens/book-screen';
import { jsonResponse, makeAuth, makeCard, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);
jest.mock('expo-file-system', () => ({ File: jest.fn(), Paths: { cache: '/cache' } }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));

const agent = {
  id: 7,
  nameAr: 'عمر حسن',
  nameEn: 'Omar Hassan',
  roleTitleAr: 'مستشار مبيعات أول',
  roleTitleEn: 'Senior sales advisor',
  rating: 4.9,
  dealsCount: 184,
  years: 7,
  languagesAr: 'العربية، الإنجليزية',
  languagesEn: 'Arabic, English',
  avgReplyMins: 4,
  phone: '+201000000001',
  colour: '#b38959',
};
const home = { ...makeCard({ id: 4, titleAr: 'فيلا في التجمع' }), agent, images: [], features: [], tourRooms: [], location: null } as unknown as PropertyDetail;

const HOURS = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];
const day = (date: string, states: Record<string, 'taken' | 'past' | 'closed'> = {}): SlotDay => ({
  date,
  slots: HOURS.map((time) => ({ time, state: states[time] ?? 'free' })),
});
const SLOTS: SlotsResponse = {
  days: [day('2026-11-12', { '10:00': 'past', '11:00': 'past' }), day('2026-11-13', { '10:00': 'closed', '16:00': 'taken' }), day('2026-11-14')],
  defaultDate: '2026-11-13',
};

const viewing = (over: Partial<ViewingItem> = {}): ViewingItem => ({
  id: 50,
  status: 'confirmed',
  mode: 'visit',
  date: '2026-11-13',
  time: '17:00',
  startsAt: '2026-11-13T15:00:00.000Z',
  rescheduledFrom: null,
  reminders: ['1d', '2h'],
  property: makeCard({ id: 4, titleAr: 'فيلا في التجمع' }),
  location: null,
  agent,
  client: null,
  createdAt: '2026-11-09T10:00:00.000Z',
  ...over,
});

/** Answers the page's requests; `book` decides what booking answers. Returns the writes. */
function serve(book: () => Response = () => jsonResponse(201, viewing()), list: ViewingItem[] = []) {
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '').split('?')[0]!;
    const method = init.method ?? 'GET';
    if (path === '/properties/4') return jsonResponse(200, home);
    if (path === '/properties/4/slots') return jsonResponse(200, SLOTS);
    if (path === '/viewings' && method === 'GET') return jsonResponse(200, list);
    if (path === '/viewings' && method === 'POST') return book();
    if (path.startsWith('/viewings/') && method === 'PATCH') return jsonResponse(200, viewing({ status: 'rescheduled', time: '18:00' }));
    return jsonResponse(200, { items: [], unread: 0 });
  });
  return () =>
    fetchMock.mock.calls
      .filter(([, init]: [string, RequestInit]) => init.method && init.method !== 'GET')
      .map(([url, init]: [string, RequestInit]) => ({ method: init.method, path: url.replace(/^.*\/v1/, ''), body: JSON.parse(init.body as string) }));
}

const Page = (props: { reschedule?: number }) => (
  <>
    <BookScreen id={4} {...props} />
    <ToastHost />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  useAuthPrompt.setState({ open: false });
  await useSession.getState().clear();
});

describe('Booking a viewing', () => {
  it('opens on the default day, with the hours grouped and their states', async () => {
    serve();
    await renderWithProviders(<Page />);
    expect(await screen.findByRole('header', { name: 'احجز معاينة' })).toBeOnTheScreen();
    // The hours load after the home: wait for them.
    expect(await screen.findByRole('button', { name: 'الجمعة ١٣ نوفمبر', selected: true })).toBeOnTheScreen();
    expect(screen.getByText('الصبح')).toBeOnTheScreen();
    expect(screen.getByText('بعد الضهر')).toBeOnTheScreen();
    expect(screen.getByText('بالليل')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '١٠:٠٠ ص، مقفولة' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '٤:٠٠ م، محجوزة' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '٥:٠٠ م' })).not.toBeDisabled();
    expect(screen.getByText('عمر حسن هيستناك في الميعاد.')).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'قبلها بيوم', checked: true })).toBeOnTheScreen();
    expect(screen.getByRole('checkbox', { name: 'قبلها بنص ساعة', checked: false })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'أكّد المعاينة' })).toBeDisabled();
  });

  it('shows past hours today, and changing the day clears the picked hour', async () => {
    serve();
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: '٥:٠٠ م' }));
    expect(screen.getByText('الجمعة ١٣ نوفمبر | ٥:٠٠ م')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'الخميس ١٢ نوفمبر' }));
    expect(screen.getByRole('button', { name: '١٠:٠٠ ص، فاتت' })).toBeDisabled();
    expect(screen.getByText('اختار ساعة عشان تكمل')).toBeOnTheScreen();
  });

  it('books the picked hour with the reminders chosen, then shows the success screen', async () => {
    await useSession.getState().setSession(makeAuth());
    const writes = serve();
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: '٥:٠٠ م' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'قبلها بنص ساعة' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'قبلها بيوم' }));
    await fireEvent.press(screen.getByRole('button', { name: 'أكّد المعاينة' }));

    expect(await screen.findByRole('header', { name: 'معاينتك اتأكدت' })).toBeOnTheScreen();
    expect(writes()).toEqual([{ method: 'POST', path: '/viewings', body: { propertyId: 4, date: '2026-11-13', time: '17:00', reminders: ['2h', '30m'] } }]);
    expect(screen.getByText('هنفكرك قبلها بيوم، وقبلها بساعتين')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'معايناتي' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/viewings');
  });

  it('asks a guest to sign in before confirming', async () => {
    const writes = serve();
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: '٥:٠٠ م' }));
    await fireEvent.press(screen.getByRole('button', { name: 'أكّد المعاينة' }));
    expect(useAuthPrompt.getState().open).toBe(true);
    expect(writes()).toEqual([]);
  });

  it('says so when the hour was just taken, and asks for another', async () => {
    await useSession.getState().setSession(makeAuth());
    serve(() => jsonResponse(409, { statusCode: 409, message: 'That time was just booked. Please pick another.' }));
    await renderWithProviders(<Page />);
    await fireEvent.press(await screen.findByRole('button', { name: '٥:٠٠ م' }));
    await fireEvent.press(screen.getByRole('button', { name: 'أكّد المعاينة' }));
    expect(await screen.findByText('الميعاد ده لسه اتحجز، اختار ميعاد تاني')).toBeOnTheScreen();
    expect(screen.getByText('اختار ساعة عشان تكمل')).toBeOnTheScreen();
  });

  it('does not spin for ever when a guest opens a reschedule link', async () => {
    serve();
    await renderWithProviders(<Page reschedule={50} />);
    expect(await screen.findByText('مش قادرين نفتح الحجز دلوقتي.')).toBeOnTheScreen();
  });

  it('reschedules: starts from the current time and sends the new one', async () => {
    await useSession.getState().setSession(makeAuth());
    const writes = serve(undefined, [viewing()]);
    await renderWithProviders(<Page reschedule={50} />);
    expect(await screen.findByRole('header', { name: 'غيّر الموعد' })).toBeOnTheScreen();
    expect(await screen.findByRole('button', { name: '٥:٠٠ م', selected: true })).toBeOnTheScreen();
    // The same time is not a change.
    expect(screen.getByRole('button', { name: 'أكّد الموعد الجديد' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: '٦:٠٠ م' }));
    await fireEvent.press(screen.getByRole('button', { name: 'أكّد الموعد الجديد' }));
    expect(await screen.findByRole('header', { name: 'اتغير الموعد' })).toBeOnTheScreen();
    await waitFor(() =>
      expect(writes()).toEqual([{ method: 'PATCH', path: '/viewings/50', body: { action: 'reschedule', date: '2026-11-13', time: '18:00', reminders: ['1d', '2h'] } }]),
    );
  });
});
