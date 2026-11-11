import type { AdminListing, InterestedClient, ListingStats } from '@maqar/shared';
import { fmtDate, lastDays } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Linking, Share } from 'react-native';
import { useSession } from '@/features/auth/store/session.store';
import { AdminListingScreen } from '@/features/admin/screens/admin-listing-screen';
import { makeAuth, makeCard, mockFetch, queryOf, jsonResponse, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const { publishedAt: _p, match: _m, ...card } = makeCard({ id: 7, titleAr: 'شقة على الحديقة', titleEn: 'Garden flat', category: 'sale' });
const listing = (over: Partial<AdminListing> = {}): AdminListing => ({
  ...card,
  status: 'approved',
  publishedAt: '2026-11-01T10:00:00.000Z',
  createdAt: '2026-11-01T10:00:00.000Z',
  ownerName: 'هاني عادل',
  ownerPhone: '+201001234567',
  agent: { id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959' },
  views: 120,
  developerAr: null,
  developerEn: null,
  floor: null,
  maintenanceFee: null,
  descAr: '',
  descEn: '',
  features: [],
  images: ['/uploads/listings/a.jpg'],
  location: null,
  ...over,
});
const stats = (n: number): ListingStats => ({
  days: lastDays('2026-11-11', n).map((day, i) => ({ day, views: i === n - 1 ? 9 : 1, saves: i === n - 1 ? 2 : 0, interested: i === n - 1 ? 1 : 0 })),
  totals: { views: 120, saves: 4, followers: 3, interested: 6, chats: 2, viewings: 1 },
  since: '2026-11-05',
});
const PEOPLE: InterestedClient[] = [
  { id: 21, name: 'كريم محمود', phone: '+201014124412', kinds: ['saved', 'booked'], firstAt: '2026-11-09T10:00:00.000Z', lastAt: new Date().toISOString() },
  { id: 22, name: 'سارة علي', phone: null, kinds: ['followed'], firstAt: '2026-11-10T10:00:00.000Z', lastAt: '2026-11-10T10:00:00.000Z' },
];

function serve(l = listing()) {
  return routeFetch({
    '/admin/listings/7': () => l,
    '/admin/agents': () => [],
    '/admin/listings/7/stats': (q) => stats(Number(q.get('days'))),
    '/admin/listings/7/interested': () => PEOPLE,
  });
}

beforeEach(async () => {
  await useSession.getState().setSession(makeAuth({ role: 'admin' }));
});

describe('Listing insights (admin listing screen)', () => {
  it('shows the last 30 days’ numbers, all-time totals and the interested clients', async () => {
    serve();
    await renderWithProviders(<AdminListingScreen id={7} />);
    expect(await screen.findByText('أرقام العقار')).toBeTruthy();
    // 29 days of 1 view, then 9 today.
    expect(await screen.findByLabelText('مشاهدات: ٣٨, ١٢٠ من الأول')).toBeTruthy();
    // Daily tracking only covers days since its start; earlier days are unknown, not zero.
    expect(await screen.findByText('الأرقام اليومية بتتسجل من ٥ نوفمبر')).toBeTruthy();
    expect(screen.getByLabelText('مهتمين جداد: ١, ٦ من الأول')).toBeTruthy();
    expect(screen.getByText('كريم محمود')).toBeTruthy();
    expect(screen.getByText('حفظه | حجز معاينة')).toBeTruthy();
    expect(screen.getByText('متابع السعر')).toBeTruthy();
  });

  it('switches the range, shows a tapped day, and calls a client', async () => {
    const fetchMock = serve();
    const call = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithProviders(<AdminListingScreen id={7} />);
    await screen.findByLabelText('مشاهدات: ٣٨, ١٢٠ من الأول');
    fireEvent.press(screen.getByRole('radio', { name: '٧ يوم' }));
    expect(await screen.findByLabelText('مشاهدات: ١٥, ١٢٠ من الأول')).toBeTruthy();
    expect(fetchMock.mock.calls.some((_, i) => queryOf(fetchMock, i).days === '7')).toBe(true);

    fireEvent.press(screen.getByLabelText('٥ نوفمبر: ١ مشاهدة، ٠ حفظ، ٠ مهتم جديد'));
    expect(await screen.findByText('١ مشاهدة | ٠ حفظ | ٠ مهتم جديد')).toBeTruthy();
    expect(screen.getAllByText('٥ نوفمبر')).toHaveLength(2);

    fireEvent.press(screen.getByLabelText('اتصل بـ كريم محمود'));
    expect(call).toHaveBeenCalledWith('tel:+201014124412');
    expect(screen.queryByLabelText('اتصل بـ سارة علي')).toBeNull();
  });

  it('falls back to the last day when the picked day leaves the shorter range', async () => {
    serve();
    await renderWithProviders(<AdminListingScreen id={7} />);
    await screen.findByLabelText('مشاهدات: ٣٨, ١٢٠ من الأول');
    fireEvent.press(screen.getByRole('radio', { name: '٩٠ يوم' }));
    expect(await screen.findByLabelText('مشاهدات: ٩٨, ١٢٠ من الأول')).toBeTruthy();

    const gone = lastDays('2026-11-11', 90)[10]!;
    fireEvent.press(screen.getByLabelText(`${fmtDate(`${gone}T12:00:00Z`, 'ar')}: ١ مشاهدة، ٠ حفظ، ٠ مهتم جديد`));
    expect(await screen.findByText(`${fmtDate(`${gone}T12:00:00Z`, 'ar')}`)).toBeTruthy();

    fireEvent.press(screen.getByRole('radio', { name: '٧ يوم' }));
    expect(await screen.findByLabelText('مشاهدات: ١٥, ١٢٠ من الأول')).toBeTruthy();
    expect(screen.getByText('المشاهدات في اليوم، دوس على يوم')).toBeTruthy();
    expect(screen.getByText('٩ مشاهدة | ٢ حفظ | ١ مهتم جديد')).toBeTruthy();
  });

  it('does not let the previous range be shared while the new range loads', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((r) => (release = r));
    mockFetch().mockImplementation(async (url: string) => {
      const [path, qs] = url.replace(/^.*\/v1/, '').split('?');
      const q = new URLSearchParams(qs);
      if (path === '/admin/listings/7/stats' && q.get('days') === '7') {
        await gate;
        return jsonResponse(200, stats(7));
      }
      if (path === '/admin/listings/7/stats') return jsonResponse(200, stats(Number(q.get('days'))));
      if (path === '/admin/listings/7/interested') return jsonResponse(200, PEOPLE);
      if (path === '/admin/listings/7') return jsonResponse(200, listing());
      if (path === '/admin/agents') return jsonResponse(200, []);
      return jsonResponse(404, { statusCode: 404, message: 'Not found' });
    });
    await renderWithProviders(<AdminListingScreen id={7} />);
    await screen.findByLabelText('مشاهدات: ٣٨, ١٢٠ من الأول');
    fireEvent.press(screen.getByRole('radio', { name: '٧ يوم' }));
    // The previous range's numbers stay visible as a placeholder, but must not be shareable.
    await waitFor(() =>
      expect(screen.getByLabelText('ابعتها للمالك').props.accessibilityState).toMatchObject({ disabled: true }),
    );
    expect(screen.getByText('الأرقام بتتحدّث للمدة المختارة…')).toBeTruthy();
    release!();
    await screen.findByLabelText('مشاهدات: ١٥, ١٢٠ من الأول');
    expect(screen.getByLabelText('ابعتها للمالك').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('shares a summary for the owner', async () => {
    serve();
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await renderWithProviders(<AdminListingScreen id={7} />);
    await screen.findByLabelText('مشاهدات: ٣٨, ١٢٠ من الأول');
    fireEvent.press(screen.getByRole('button', { name: 'ابعتها للمالك' }));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining('آخر ٣٠ يوم: ٣٨ مشاهدة') });
  });

  it('is not shown on a draft, which clients have never seen', async () => {
    serve(listing({ status: 'draft', agent: null, publishedAt: null }));
    await renderWithProviders(<AdminListingScreen id={7} />);
    expect(await screen.findByText('شقة على الحديقة')).toBeTruthy();
    expect(screen.queryByText('أرقام العقار')).toBeNull();
  });
});
