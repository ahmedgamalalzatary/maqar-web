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
// Videos upload natively from the phone's disk (File.upload); photos are sent as bytes.
const VIDEO = { url: '/uploads/videos/new.mp4', poster: '/uploads/videos/new.jpg', durationS: 42, width: 1280, height: 720 };
const mockUpload = jest.fn(async (_url: string, _opts: { fieldName?: string; headers?: Record<string, string> }) => ({ status: 201, body: JSON.stringify(VIDEO), headers: {} }));
jest.mock('expo-file-system', () => ({
  UploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
  File: jest.fn().mockImplementation(() => ({ bytes: async () => new Uint8Array([1]), upload: mockUpload })),
}));

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
  tourRooms: [],
  videos: [],
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
function serve(start: AdminListing = detail(), opts: { publishFails?: boolean; uploadsFailFirst?: number } = {}) {
  let current = start;
  let uploadsLeftToFail = opts.uploadsFailFirst ?? 0;
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit = {}) => {
    const [path, qs] = url.replace(/^.*\/v1/, '').split('?');
    const method = init.method ?? 'GET';
    const body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    if (path === '/areas') return jsonResponse(200, AREAS);
    if (path === '/admin/agents') return jsonResponse(200, AGENTS);
    if (path === '/uploads/panoramas') return jsonResponse(201, { url: '/uploads/tours/new.jpg' });
    if (path === '/uploads') {
      if (uploadsLeftToFail > 0) {
        uploadsLeftToFail -= 1;
        return jsonResponse(500, { statusCode: 500, message: 'Upload failed' });
      }
      return jsonResponse(201, { url: '/uploads/listings/new.jpg' });
    }
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

  it('loads the next page when the list is longer than the first page (UI-14)', async () => {
    const page = (n: number, total: number): AdminListingsPage => ({
      items: Array.from({ length: n }, (_, i) => item({ id: i + 1, titleAr: `عقار ${i + 1}` })),
      page: 1,
      limit: 100,
      total,
      counts: counts({ draft: total }),
    });
    const fetchMock = mockFetch().mockImplementation((url: string) => {
      const qs = new URLSearchParams(url.replace(/^.*\/v1\/admin\/listings\??/, ''));
      const p = Number(qs.get('page') ?? 1);
      return Promise.resolve(jsonResponse(200, p === 1 ? page(100, 101) : { ...page(1, 101), page: 2 }));
    });
    await renderWithProviders(<AdminListingsScreen />);
    expect(await screen.findByText('عقار 1')).toBeOnTheScreen();
    expect(screen.queryByText('عقار 101')).toBeNull();

    // Reaching the end of the first page asks for the second one (the list virtualizes, so the
    // new rows may not render in the test tree; the fetch is the behavior).
    const list = screen.getByTestId('admin-listings');
    await list.props.onEndReached();
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('page=2'))).toBe(true));
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

  it('walks the steps, stops on what is missing, uploads the photos and saves a draft', async () => {
    const writes = serve();
    pickTwo();
    await renderWithProviders(withToasts(<ListingFormScreen />));
    expect(screen.getByText('الخطوة ١ من ٧: النوع')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('اختار نوع الوحدة')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: 'للإيجار' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'شقة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByText('الخطوة ٢ من ٧: المكان')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByRole('radio', { name: 'الشيخ زايد' }));
    await fireEvent.changeText(screen.getByLabelText('اسم المالك'), 'هاني عادل');
    await fireEvent.changeText(screen.getByLabelText('موبايل المالك'), '+201001234567');
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByText('الخطوة ٣ من ٧: التفاصيل')).toBeOnTheScreen();
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

    expect(screen.getByText('الخطوة ٤ من ٧: الصور')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('ضيف صورة واحدة على الأقل، واستنى لحد ما الصور تترفع')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف صور' }));
    await waitFor(() => expect(screen.getAllByTestId('form-photo')).toHaveLength(2));
    await waitFor(() => expect(writes().filter(([, u]) => u === '/uploads')).toHaveLength(2));
    await fireEvent.press(screen.getByRole('button', { name: 'امسح الصورة ٢' }));
    expect(screen.getAllByTestId('form-photo')).toHaveLength(1);
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    // Videos and the 360° tour may stay empty.
    expect(screen.getByText('الخطوة ٥ من ٧: الفيديوهات')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('الخطوة ٦ من ٧: جولة ٣٦٠°')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByText('الخطوة ٧ من ٧: المراجعة')).toBeOnTheScreen();
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
      videos: [],
      tour: [],
    });
    expect(writes().some(([, u]) => String(u).endsWith('/publish'))).toBe(false);
    expect(mockRouter.replace).toHaveBeenCalledWith('/admin/listing/9');
  });

  it('keeps a failed photo across step navigation, and its retry succeeds (UI-08)', async () => {
    const writes = serve(detail(), { uploadsFailFirst: 1 });
    pickTwo();
    await renderWithProviders(withToasts(<ListingFormScreen />));
    await fireEvent.press(screen.getByRole('radio', { name: 'شقة' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الشيخ زايد' }));
    await fireEvent.changeText(screen.getByLabelText('اسم المالك'), 'هاني عادل');
    await fireEvent.changeText(screen.getByLabelText('موبايل المالك'), '+201001234567');
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.changeText(await screen.findByLabelText('الغرف'), '2');
    await fireEvent.changeText(screen.getByLabelText('الحمامات'), '1');
    await fireEvent.changeText(screen.getByLabelText('المساحة (م²)'), '120');
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.changeText(screen.getByLabelText('السعر (جنيه)'), '5000000');
    await fireEvent.press(screen.getByRole('radio', { name: 'تشطيب كامل' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    // Two photos picked: the first upload fails (its tile shows a retry), the second lands.
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف صور' }));
    expect(await screen.findByRole('button', { name: 'حاول ترفعها تاني' })).toBeOnTheScreen();
    await waitFor(() => expect(screen.getAllByTestId('form-photo')).toHaveLength(2));

    // Back a step and forward again (Next is blocked while an upload failed):
    // the failed photo and its retry are still there.
    await fireEvent.press(screen.getByRole('button', { name: 'السابق' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByRole('button', { name: 'حاول ترفعها تاني' })).toBeOnTheScreen();

    // The retry uploads now, and the saved draft carries both photos.
    await fireEvent.press(screen.getByRole('button', { name: 'حاول ترفعها تاني' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'حاول ترفعها تاني' })).toBeNull());
    expect(screen.getAllByTestId('form-photo')).toHaveLength(2);
    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ مسودة' }));
    expect(await screen.findByText('العقار اتحفظ كمسودة')).toBeOnTheScreen();
    const save = writes().find(([m, u]) => m === 'POST' && u === '/admin/listings');
    expect(save?.[2]).toMatchObject({ images: ['/uploads/listings/new.jpg', '/uploads/listings/new.jpg'] });
  });

  it('edits a saved listing: the steps start filled in, and only Save changes is offered', async () => {
    const writes = serve(detail({ beds: 3, baths: 2, sizeM2: 165, price: 7_250_000, type: 'apartment', finishing: 'full' }));
    await renderWithProviders(withToasts(<ListingFormScreen id={7} />));
    expect(await screen.findByRole('header', { name: 'عدّل العقار' })).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: 'شقة', checked: true })).toBeOnTheScreen();
    for (let i = 0; i < 2; i++) await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.changeText(screen.getByLabelText('السعر (جنيه)'), '6900000');
    for (let i = 0; i < 4; i++) await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.queryByRole('button', { name: 'احفظ وانشر' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ التعديلات' }));
    expect(await screen.findByText('التعديلات اتحفظت')).toBeOnTheScreen();
    const [[method, url, body]] = writes();
    expect([method, url]).toEqual(['PATCH', '/admin/listings/7']);
    expect(body).toMatchObject({ price: 6_900_000, images: ['/uploads/listings/a.jpg', '/uploads/listings/b.jpg'] });
    expect(mockRouter.back).toHaveBeenCalled();
  });

  /** Fills the steps up to the videos with the least the form needs. */
  async function fillToVideos() {
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
  async function fillToTour() {
    await fillToVideos();
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
  }
  async function fillAll() {
    await fillToTour();
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
  }

  it('adds a 360° tour room from a 2:1 photo, needs its names, and saves it with the listing', async () => {
    const writes = serve();
    await renderWithProviders(withToasts(<ListingFormScreen />));
    await fillToTour();
    expect(screen.getByText('الخطوة ٦ من ٧: جولة ٣٦٠°')).toBeOnTheScreen();

    // A normal photo is not a panorama: nothing is added or uploaded.
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///flat.jpg', width: 4000, height: 3000 }] as ImagePicker.ImagePickerAsset[] });
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف غرفة' }));
    expect(await screen.findByText('الصورة دي مش ٣٦٠°: لازم عرضها ضعف طولها (٢:١)')).toBeOnTheScreen();
    expect(screen.queryAllByTestId('tour-room')).toHaveLength(0);

    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [{ uri: 'file:///pano.jpg', width: 6000, height: 3000 }] as ImagePicker.ImagePickerAsset[] });
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف غرفة' }));
    await waitFor(() => expect(screen.getAllByTestId('tour-room')).toHaveLength(1));
    await waitFor(() => expect(writes().filter(([, u]) => u === '/uploads/panoramas')).toHaveLength(1));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    expect(screen.getByText('كل غرفة محتاجة اسمها بالعربي والإنجليزي، واستنى لحد ما الصور تترفع')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('اسم الغرفة ١ (عربي)'), 'الصالة');
    await fireEvent.changeText(screen.getByLabelText('اسم الغرفة ١ (إنجليزي)'), 'Living room');
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByRole('button', { name: 'جولة ٣٦٠°: ١ غرفة' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ مسودة' }));
    expect(await screen.findByText('العقار اتحفظ كمسودة')).toBeOnTheScreen();
    const save = writes().find(([m, u]) => m === 'POST' && u === '/admin/listings');
    expect(save?.[2]).toMatchObject({ tour: [{ nameAr: 'الصالة', nameEn: 'Living room', pano: '/uploads/tours/new.jpg' }] });
  });

  it('adds videos: refuses one over 3 minutes, uploads the rest from the phone, and saves them in order', async () => {
    const writes = serve();
    await renderWithProviders(withToasts(<ListingFormScreen />));
    await fillToVideos();
    expect(screen.getByText('الخطوة ٥ من ٧: الفيديوهات')).toBeOnTheScreen();

    const asset = (over: Partial<ImagePicker.ImagePickerAsset>) =>
      ({ uri: 'file:///v.mov', width: 1920, height: 1080, type: 'video', mimeType: 'video/quicktime', fileSize: 30_000_000, duration: 42_000, ...over }) as ImagePicker.ImagePickerAsset;
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [asset({ uri: 'file:///long.mov', duration: 200_000 })] });
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف فيديوهات' }));
    expect(await screen.findByText('الفيديو أطول من ٣ دقايق')).toBeOnTheScreen();
    expect(screen.queryAllByTestId('form-video')).toHaveLength(0);
    expect(jest.mocked(ImagePicker.launchImageLibraryAsync).mock.calls.at(-1)![0]).toMatchObject({ mediaTypes: ['videos'] });

    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValueOnce({ canceled: false, assets: [asset({})] });
    await fireEvent.press(screen.getByRole('button', { name: 'ضيف فيديوهات' }));
    await waitFor(() => expect(screen.getAllByTestId('form-video')).toHaveLength(1));
    expect(await screen.findByText('٠:٤٢')).toBeOnTheScreen();
    // Streamed from disk as the video field, with the session's token.
    const [url, opts] = mockUpload.mock.calls.at(-1)!;
    expect(url).toMatch(/\/v1\/uploads\/videos$/);
    expect(opts).toMatchObject({ fieldName: 'video', headers: { Authorization: expect.stringMatching(/^Bearer /) } });
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));
    await fireEvent.press(screen.getByRole('button', { name: 'التالي' }));

    expect(screen.getByRole('button', { name: 'الفيديوهات: ١ فيديو' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'احفظ مسودة' }));
    expect(await screen.findByText('العقار اتحفظ كمسودة')).toBeOnTheScreen();
    const save = writes().find(([m, u]) => m === 'POST' && u === '/admin/listings');
    expect(save?.[2]).toMatchObject({ videos: ['/uploads/videos/new.mp4'] });
  });

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
    expect(screen.getByText('الخطوة ٢ من ٧: المكان')).toBeOnTheScreen();
  });

  it('says which step it is in English too', async () => {
    serve();
    await renderWithProviders(<ListingFormScreen />, { lang: 'en' });
    expect(screen.getByText('Step 1 of 7: Type')).toBeOnTheScreen();
  });

  it('says so when the listing to edit cannot be found, instead of loading for ever', async () => {
    serve();
    await renderWithProviders(<ListingFormScreen id={404} />);
    expect(await screen.findByText('العقار ده مش موجود.')).toBeOnTheScreen();
  });
});
