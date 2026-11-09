import type { ViewingItem } from '@maqar/shared';
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';
import { useSession } from '@/features/auth/store/session.store';
import { NextViewingCard } from '@/features/viewings/components/next-viewing-card';
import { ViewingsScreen } from '@/features/viewings/screens/viewings-screen';
import { jsonResponse, makeAuth, makeCard, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);
const mockWrite = jest.fn();
jest.mock('expo-file-system', () => ({
  Paths: { cache: '/cache' },
  File: jest.fn().mockImplementation(() => ({ exists: false, create: jest.fn(), write: mockWrite, delete: jest.fn(), uri: 'file:///cache/v.ics' })),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(async () => undefined) }));

const agent = {
  id: 7,
  nameAr: 'عمر حسن',
  nameEn: 'Omar Hassan',
  roleTitleAr: 'مستشار',
  roleTitleEn: 'Advisor',
  rating: 4.9,
  dealsCount: 1,
  years: 1,
  languagesAr: 'العربية',
  languagesEn: 'Arabic',
  avgReplyMins: 4,
  phone: '+201000000001',
  colour: '#b38959',
};
const DAY = 86_400_000;
const at = (ms: number) => new Date(Date.now() + ms).toISOString();
const viewing = (over: Partial<ViewingItem>): ViewingItem => ({
  id: 1,
  status: 'confirmed',
  mode: 'visit',
  date: '2026-11-20',
  time: '17:00',
  startsAt: at(3 * DAY),
  rescheduledFrom: null,
  reminders: [],
  property: makeCard({ id: 4, titleAr: 'فيلا في التجمع' }),
  location: { lat: 30.01, lng: 31.42 },
  agent,
  client: null,
  createdAt: at(-DAY),
  ...over,
});
const LIST = [
  viewing({ id: 1, rescheduledFrom: { date: '2026-11-18', time: '16:00' }, status: 'rescheduled' }),
  viewing({ id: 2, date: '2026-11-25', startsAt: at(8 * DAY), property: makeCard({ id: 5, titleAr: 'شقة في زايد' }) }),
  viewing({ id: 3, status: 'cancelled', startsAt: at(2 * DAY), property: makeCard({ id: 6, titleAr: 'شاليه ملغي' }) }),
  viewing({ id: 4, startsAt: at(-3 * DAY), property: makeCard({ id: 7, titleAr: 'تاون هاوس فات' }) }),
];

function serve(list = LIST) {
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '');
    if (path === '/viewings' && (init.method ?? 'GET') === 'GET') return jsonResponse(200, list);
    if (path.endsWith('/ics')) return new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', { status: 200 });
    if (init.method === 'PATCH') return jsonResponse(200, { ...list[0], status: 'cancelled' });
    return jsonResponse(200, { items: [], unread: 0 });
  });
  return () =>
    fetchMock.mock.calls
      .filter(([, init]: [string, RequestInit]) => init.method === 'PATCH')
      .map(([url, init]: [string, RequestInit]) => [url.replace(/^.*\/v1/, ''), JSON.parse(init.body as string)]);
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

describe('My viewings', () => {
  it('asks a guest to sign in', async () => {
    serve();
    await renderWithProviders(<ViewingsScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });

  it('splits upcoming from past and cancelled, soonest first, with the status and where it was', async () => {
    await useSession.getState().setSession(makeAuth());
    serve();
    await renderWithProviders(<ViewingsScreen />);
    const homes = async () => (await screen.findAllByRole('button', { name: /فيلا|شقة|شاليه|تاون/ })).map((b) => b.props.accessibilityLabel);
    expect(await homes()).toEqual(['فيلا في التجمع', 'شقة في زايد']);
    expect(screen.getByText('اتغير موعدها')).toBeOnTheScreen();
    expect(screen.getByText('كانت ١٨ نوفمبر ٤:٠٠ م')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'السابقة والملغاة' }));
    expect(await homes()).toEqual(['شاليه ملغي', 'تاون هاوس فات']);
    expect(screen.getByText('ملغاة')).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'احجز ميعاد جديد' })).toHaveLength(2);
  });

  it('cancels after asking', async () => {
    await useSession.getState().setSession(makeAuth());
    const patches = serve([LIST[0]!]);
    await renderWithProviders(<ViewingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'إلغاء' }));
    expect(screen.getByText('إلغاء المعاينة؟')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'لا، خليها' }));
    expect(patches()).toEqual([]);
    await fireEvent.press(screen.getByRole('button', { name: 'إلغاء' }));
    await fireEvent.press(screen.getByRole('button', { name: 'إلغاء المعاينة' }));
    await waitFor(() => expect(patches()).toEqual([['/viewings/1', { action: 'cancel' }]]));
  });

  it('changes the time, gives directions, calls the advisor, and adds it to the calendar', async () => {
    await useSession.getState().setSession(makeAuth());
    serve([LIST[0]!]);
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithProviders(<ViewingsScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'تغيير' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/property/4/book?reschedule=1');
    await fireEvent.press(screen.getByRole('button', { name: 'الاتجاهات' }));
    expect(open).toHaveBeenCalledWith(expect.stringContaining('30.01,31.42'));
    await fireEvent.press(screen.getByRole('button', { name: 'اتصل بـعمر حسن' }));
    expect(open).toHaveBeenCalledWith('tel:+201000000001');
    await fireEvent.press(screen.getByRole('button', { name: 'للتقويم' }));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/v.ics', expect.objectContaining({ mimeType: 'text/calendar' })));
    expect(mockWrite).toHaveBeenCalledWith('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n');
  });

  it('has an empty state for each tab', async () => {
    await useSession.getState().setSession(makeAuth());
    serve([]);
    await renderWithProviders(<ViewingsScreen />);
    expect(await screen.findByText('مفيش معاينات جاية')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'السابقة والملغاة' }));
    expect(screen.getByText('لسه مفيش معاينات سابقة')).toBeOnTheScreen();
  });
});

describe('Your next viewing on Home', () => {
  it('shows the soonest upcoming one and opens My viewings', async () => {
    await useSession.getState().setSession(makeAuth());
    serve();
    await renderWithProviders(<NextViewingCard />);
    const card = await screen.findByRole('button', { name: /^معاينتك الجاية: فيلا في التجمع/ });
    expect(within(card).getByText('الجمعة ٢٠ نوفمبر | ٥:٠٠ م')).toBeOnTheScreen();
    await fireEvent.press(card);
    expect(mockRouter.push).toHaveBeenCalledWith('/viewings');
  });

  it('is not there without one', async () => {
    await useSession.getState().setSession(makeAuth());
    serve([LIST[3]!]);
    await renderWithProviders(<NextViewingCard />);
    await waitFor(() => expect(screen.queryByRole('button', { name: /معاينتك الجاية/ })).toBeNull());
  });
});
