import type { AdminAgentOption, AdminListing, AdminListingItem, AdminListingsPage, PropertyStatus } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { ToastHost } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { AdminListingScreen } from '@/features/admin/screens/admin-listing-screen';
import { AdminListingsScreen } from '@/features/admin/screens/admin-listings-screen';
import { ListingFormScreen } from '@/features/admin/screens/listing-form-screen';
import { AREAS, jsonResponse, makeAuth, makeCard, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);
jest.mock('expo-file-system', () => ({ File: jest.fn().mockImplementation(() => ({ bytes: async () => new Uint8Array([1]) })) }));

const { publishedAt: _p, match: _m, ...card } = makeCard({ id: 7, titleAr: 'شقة على الحديقة', titleEn: 'Garden flat', category: 'sale' });
const item = (over: Partial<AdminListingItem> = {}): AdminListingItem => ({
  ...card,
  status: 'draft',
  publishedAt: null,
  createdAt: '2026-11-10T10:00:00.000Z',
  ownerName: 'هاني عادل',
  ownerPhone: '+201001234567',
  agent: null,
  views: 0,
  ...over,
});
const detail = (over: Partial<AdminListing> = {}): AdminListing => ({
  ...item(),
  developerAr: null,
  developerEn: null,
  floor: null,
  maintenanceFee: null,
  descAr: '',
  descEn: '',
  features: ['garden'],
  images: ['/uploads/listings/a.jpg', '/uploads/listings/b.jpg'],
  location: null,
  ...over,
});
const AGENTS: AdminAgentOption[] = [
  { id: 4, nameAr: 'سلمى فؤاد', nameEn: 'Salma Fouad', colour: '#61766d', live: 3 },
  { id: 3, nameAr: 'عمر حسن', nameEn: 'Omar Hassan', colour: '#b38959', live: 8 },
];
const counts = (c: Partial<Record<PropertyStatus, number>>): Record<PropertyStatus, number> => ({ draft: 0, approved: 0, unpublished: 0, sold: 0, rented: 0, ...c });

/** A stateful fake API for the admin screens. Returns the writes. */
function serve(start: AdminListing = detail(), opts: { publishFails?: boolean } = {}) {
  let current = start;
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const [path, qs] = url.replace(/^.*\/v1/, '').split('?');
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (path === '/areas') return jsonResponse(200, AREAS);
    if (path === '/admin/agents') return jsonResponse(200, AGENTS);
    if (path === '/uploads') return jsonResponse(201, { url: '/uploads/listings/new.jpg' });
    if (path === '/admin/listings' && method === 'GET') {
      const status = new URLSearchParams(qs).get('status');
      const all = [item({ id: 7 }), item({ id: 8, titleAr: 'فيلا منشورة', status: 'approved', agent: AGENTS[1]! })];
      const page: AdminListingsPage = { items: all.filter((i) => !status || i.status === status), page: 1, limit: 100, total: 2, counts: counts({ draft: 1, approved: 1 }) };
      return jsonResponse(200, page);
    }
    if (path === '/admin/listings' && method === 'POST') {
      current = detail({ ...body, id: 9, status: 'draft' });
      return jsonResponse(201, current);
    }
    if (path === `/admin/listings/${current.id}` && method === 'GET') return jsonResponse(200, current);
    if (path === `/admin/listings/${current.id}` && method === 'PATCH') {
      current = { ...current, ...body };
      return jsonResponse(200, current);
    }
    if (path === `/admin/listings/${current.id}/publish` && opts.publishFails) return jsonResponse(400, { statusCode: 400, message: 'There is no active sales advisor to assign' });
    if (path === `/admin/listings/${current.id}/publish`) {
      current = { ...current, status: 'approved', agent: AGENTS.find((a) => a.id === body?.agentId) ?? AGENTS[0]!, publishedAt: '2026-11-10T12:00:00.000Z' };
      return jsonResponse(200, current);
    }
    if (path === `/admin/listings/${current.id}/unpublish`) {
      current = { ...current, status: 'unpublished' };
      return jsonResponse(200, current);
    }
    if (path === `/admin/listings/${current.id}/close`) {
      current = { ...current, status: 'sold' };
      return jsonResponse(200, current);
    }
    return jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
  return () =>
    fetchMock.mock.calls
      .filter(([, init]: [string, RequestInit]) => init?.method && init.method !== 'GET')
      .map(([url, init]: [string, RequestInit]) => [init.method, url.replace(/^.*\/v1/, ''), typeof init.body === 'string' ? JSON.parse(init.body) : 'form']);
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

describe('Admin listings tab', () => {
  it('lists every status with counts, filters by status, and opens a listing', async () => {
    serve();
    await renderWithProviders(<AdminListingsScreen />);
    expect(await screen.findByText('شقة على الحديقة')).toBeOnTheScreen();
    expect(screen.getByText('فيلا منشورة')).toBeOnTheScreen();
    expect(screen.getByText('٢ عقار، ١ منشور')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'مسودة، ١' })).toBeOnTheScreen();
    expect(screen.getByText('من غير مسؤول لسه | ٠ مشاهدة')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('radio', { name: 'منشور، ١' }));
    await waitFor(() => expect(screen.queryByText('شقة على الحديقة')).toBeNull());
    await fireEvent.press(screen.getByRole('button', { name: 'فيلا منشورة، منشور' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/admin/listing/8');
  });
});

describe('Admin listing page', () => {
  it('shows the owner, then publishes with the advisor the admin picks', async () => {
    const writes = serve();
    await renderWithProviders(withToasts(<AdminListingScreen id={7} />));
    expect(await screen.findByRole('header', { name: 'شقة على الحديقة' })).toBeOnTheScreen();
    expect(screen.getByText('هاني عادل')).toBeOnTheScreen();
    expect(screen.getByText('هيتحدد لما تنشر العقار')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'أوقف النشر' })).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'انشر العقار' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'عمر حسن' }));
    expect(await screen.findByText('العقار اتنشر وبقى ظاهر في استكشف')).toBeOnTheScreen();
    expect(screen.getByText('عمر حسن')).toBeOnTheScreen();
    expect(writes()).toEqual([['POST', '/admin/listings/7/publish', { agentId: 3 }]]);
  });

  it('unpublishes a live listing and marks it sold', async () => {
    const writes = serve(detail({ status: 'approved', agent: AGENTS[0]!, publishedAt: '2026-11-09T10:00:00.000Z' }));
    await renderWithProviders(withToasts(<AdminListingScreen id={7} />));
    await fireEvent.press(await screen.findByRole('button', { name: 'أوقف النشر' }));
    expect(await screen.findByRole('button', { name: 'انشره تاني' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'اتباع' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'اتباع' })).toBeNull());
    expect(writes().map(([m, u]) => `${m} ${u}`)).toEqual(['POST /admin/listings/7/unpublish', 'POST /admin/listings/7/close']);
  });
});

describe('Listing form', () => {
  const pickTwo = () =>
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({
      canceled: false,
      assets: [
        { uri: 'file:///a.jpg', width: 3000, height: 2000 },
        { uri: 'file:///b.jpg', width: 800, height: 600 },
      ] as ImagePicker.ImagePickerAsset[],
    });

  it('walks the five steps, stops on what is missing, uploads the photos and saves a draft', async () => {
    const writes = serve();
    pickTwo();
    await renderWithProviders(withToasts(<ListingFormScreen />));
    expect(screen.getByText('الخطوة ١ من ٥: النوع')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('اختار نوع الوحدة')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'للإيجار' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'شقة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByText('الخطوة ٢ من ٥: المكان')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('radio', { name: 'الشيخ زايد' }));
    await fireEvent.changeText(screen.getByLabelText('اسم المالك'), 'هاني عادل');
    await fireEvent.changeText(screen.getByLabelText('موبايل المالك'), '+201001234567');
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByText('الخطوة ٣ من ٥: التفاصيل')).toBeOnTheScreen();
    // A rent has no payment plan.
    expect(screen.queryByText('خطة السداد (اختياري)')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('الغرف'), '٢');
    await fireEvent.changeText(screen.getByLabelText('الحمامات'), '1');
    await fireEvent.changeText(screen.getByLabelText('المساحة (م²)'), '120');
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('اكتب السعر بالجنيه')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('الإيجار في الشهر (جنيه)'), '45,000');
    await fireEvent.press(screen.getByRole('radio', { name: 'مفروش' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: 'حمام سباحة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByText('الخطوة ٤ من ٥: الصور')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('ضيف صورة واحدة على الأقل، واستنى لحد ما الصور تترفع')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف صور' }));
    await waitFor(() => expect(screen.getAllByTestId('form-photo')).toHaveLength(2));
    await waitFor(() => expect(writes().filter(([, u]) => u === '/uploads')).toHaveLength(2));
    await fireEvent.press(screen.getByRole('button', { name: 'امسح الصورة ٢' }));
    expect(screen.getAllByTestId('form-photo')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByText('الخطوة ٥ من ٥: المراجعة')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'المالك: هاني عادل | +201001234567' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ مسودة' }));
    expect(await screen.findByText('العقار اتحفظ كمسودة')).toBeOnTheScreen();
    const save = writes().find(([m, u]) => m === 'POST' && u === '/admin/listings');
    expect(save?.[2]).toMatchObject({
      category: 'rent',
      type: 'apartment',
      areaId: 'zayed',
      price: 45_000,
      beds: 2,
      baths: 1,
      sizeM2: 120,
      finishing: 'furnished',
      features: ['pool'],
      plan: null,
      images: ['/uploads/listings/new.jpg'],
      ownerName: 'هاني عادل',
      ownerPhone: '+201001234567',
      titleAr: '',
    });
    expect(writes().some(([, u]) => String(u).endsWith('/publish'))).toBe(false);
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/listing/9');
  });

  it('edits a saved listing: the steps start filled in, and only Save changes is offered', async () => {
    const writes = serve(detail({ beds: 3, baths: 2, sizeM2: 165, price: 7_250_000, type: 'apartment', finishing: 'full' }));
    await renderWithProviders(withToasts(<ListingFormScreen id={7} />));
    expect(await screen.findByRole('header', { name: 'عدّل العقار' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'شقة', checked: true })).toBeOnTheScreen();
    for (let i = 0; i < 2; i++) await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.changeText(screen.getByLabelText('السعر (جنيه)'), '6900000');
    for (let i = 0; i < 2; i++) await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.queryByRole('button', { name: 'احفظ وانشر' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ التعديلات' }));
    expect(await screen.findByText('التعديلات اتحفظت')).toBeOnTheScreen();
    const [[method, url, body]] = writes();
    expect([method, url]).toEqual(['PATCH', '/admin/listings/7']);
    expect(body).toMatchObject({ price: 6_900_000, images: ['/uploads/listings/a.jpg', '/uploads/listings/b.jpg'] });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  /** Fills the five steps with the least the form needs. */
  async function fillAll() {
    await fireEvent.press(screen.getByRole('radio', { name: 'شقة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الشيخ زايد' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.changeText(screen.getByLabelText('الغرف'), '2');
    await fireEvent.changeText(screen.getByLabelText('الحمامات'), '1');
    await fireEvent.changeText(screen.getByLabelText('المساحة (م²)'), '120');
    await fireEvent.changeText(screen.getByLabelText('السعر (جنيه)'), '5000000');
    await fireEvent.press(screen.getByRole('radio', { name: 'تشطيب كامل' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    pickTwo();
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف صور' }));
    await waitFor(() => expect(screen.getAllByTestId('form-photo')).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'حاول ترفعها تاني' })).toBeNull());
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
  }

  it('when publishing fails after the save, says so and opens the saved draft instead of saving it twice', async () => {
    const writes = serve(detail(), { publishFails: true });
    await renderWithProviders(withToasts(<ListingFormScreen />));
    await fillAll();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ وانشر' }));
    expect(await screen.findByText('اتحفظ كمسودة بس متنشرش، جرّب تنشره من صفحته')).toBeOnTheScreen();
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/listing/9');
    expect(writes().filter(([m, u]) => m === 'POST' && u === '/admin/listings')).toHaveLength(1);
  });

  it('refuses an owner phone that is not one, before saving', async () => {
    serve();
    await renderWithProviders(<ListingFormScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'شقة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الشيخ زايد' }));
    await fireEvent.changeText(screen.getByLabelText('موبايل المالك'), 'call me');
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('رقم موبايل بالأرقام، مثلًا ٠١٠١٢٣٤٥٦٧٨')).toBeOnTheScreen();
    expect(screen.getByText('الخطوة ٢ من ٥: المكان')).toBeOnTheScreen();
  });

  it('says which step it is in English too', async () => {
    serve();
    await renderWithProviders(<ListingFormScreen />, { lang: 'en' });
    expect(screen.getByText('Step 1 of 5: Type')).toBeOnTheScreen();
  });

  it('says so when the listing to edit cannot be found, instead of loading for ever', async () => {
    serve();
    await renderWithProviders(<ListingFormScreen id={404} />);
    expect(await screen.findByText('العقار ده مش موجود.')).toBeOnTheScreen();
  });
});
