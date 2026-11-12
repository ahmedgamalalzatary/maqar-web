import type { PropertyDetail } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { CompareScreen } from '@/features/compare/screens/compare-screen';
import { useCompare } from '@/features/compare/store/compare.store';
import { makeCard, makeMe, page, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const detail = (over: Partial<PropertyDetail>): PropertyDetail => ({
  ...makeCard(),
  developerAr: null,
  videos: [],
  developerEn: null,
  floor: null,
  maintenanceFee: null,
  descAr: '',
  descEn: '',
  features: [],
  images: [],
  views: 100,
  tourRooms: [],
  location: null,
  agent: {
    id: 3,
    nameAr: 'عمر',
    nameEn: 'Omar',
    roleTitleAr: '',
    roleTitleEn: '',
    rating: 5,
    dealsCount: 1,
    years: 1,
    languagesAr: '',
    languagesEn: '',
    avgReplyMins: 1,
    phone: '',
    colour: '#000',
  },
  ...over,
});

const villa = detail({ id: 1, tour: true, titleAr: 'فيلا', titleEn: 'Villa', price: 10_000_000, sizeM2: 200, delivery: 2028, features: ['pool'], maintenanceFee: 8 });
const flat = detail({ id: 2, titleAr: 'شقة', titleEn: 'Flat', price: 9_000_000, sizeM2: 150, features: ['gym'], maintenanceFee: 10 });
const studio = makeCard({ id: 5, titleAr: 'ستوديو', titleEn: 'Studio' });

function api(homes: PropertyDetail[] = [villa, flat]) {
  return routeFetch({
    '/properties/compare': (q) => q.get('ids')!.split(',').map(Number).flatMap((id) => homes.filter((h) => h.id === id)),
    '/properties': () => page([studio, makeCard({ id: 2, titleAr: 'شقة' })]),
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
  useCompare.setState({ homes: [] });
});

describe('The compare screen', () => {
  it('shows both homes, the verdict and the better value in each row, counting no view', async () => {
    useCompare.setState({ homes: [{ id: 1, cover: null }, { id: 2, cover: null }] });
    const fetchMock = api();
    await renderWithProviders(<CompareScreen />, { lang: 'en' });

    expect(await screen.findByText('17% cheaper per m²')).toBeTruthy();
    expect(screen.getByText('50 m² bigger')).toBeTruthy();
    expect(screen.getByText('Ready to move in now')).toBeTruthy();
    // Guests get no fit line.
    expect(screen.queryByText(/Better fit/)).toBeNull();

    expect(screen.getByLabelText('Price B: EGP 9M, better')).toBeTruthy();
    expect(screen.getByLabelText('Price per m² A: EGP 50,000, better')).toBeTruthy();
    expect(screen.getByLabelText('Size A: 200 m², better')).toBeTruthy();
    expect(screen.getByLabelText('Maintenance A: 8%, better')).toBeTruthy();
    expect(screen.getByLabelText('Delivery B: Ready, better')).toBeTruthy();
    // Views are not compared (removed 2026-11-12).
    expect(screen.queryByLabelText('Views A: 100')).toBeNull();
    expect(screen.getByLabelText('Pool A: yes')).toBeTruthy();
    expect(screen.getByLabelText('Pool B: no')).toBeTruthy();
    expect(screen.getByLabelText('360° tour A: yes')).toBeTruthy();
    expect(screen.getByLabelText('360° tour B: no')).toBeTruthy();

    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls.some((u) => u.endsWith('/properties/compare?ids=1,2'))).toBe(true);
    expect(urls.some((u) => /\/properties\/\d+$/.test(u))).toBe(false);
  });

  it('adds the better fit for a signed-in client', async () => {
    useSession.setState({
      status: 'signedIn',
      accessToken: 'a',
      user: makeMe({ role: 'client', prefs: { purpose: ['sale'], budgetMax: 9_500_000, areas: [], types: [], beds: 0, interests: [] } }),
    });
    useCompare.setState({ homes: [{ id: 1, cover: null }, { id: 2, cover: null }] });
    routeFetch({
      '/properties/compare': () => [villa, flat],
      '/favorites': () => [],
    });
    await renderWithProviders(<CompareScreen />, { lang: 'en' });
    expect(await screen.findByText(/^Better fit for you/)).toBeTruthy();
  });

  it('asks for two homes, and picks one from the sheet', async () => {
    useCompare.setState({ homes: [{ id: 1, cover: null }] });
    api();
    await renderWithProviders(<CompareScreen />);
    expect(await screen.findByText('فيلا')).toBeTruthy();
    expect(screen.getByText(/اختار وحدتين عشان نقارنهم/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'اختار وحدة' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'شقة' }));
    await waitFor(() => expect(useCompare.getState().homes.map((h) => h.id)).toEqual([1, 2]));
    expect(await screen.findByText(/أرخص في سعر المتر/)).toBeTruthy();
  });

  it('removes a home, and drops one that is no longer listed', async () => {
    useCompare.setState({ homes: [{ id: 1, cover: null }, { id: 9, cover: null }] });
    api();
    await renderWithProviders(<CompareScreen />);
    await waitFor(() => expect(useCompare.getState().homes.map((h) => h.id)).toEqual([1]));
    await fireEvent.press(screen.getByRole('button', { name: 'شيل A' }));
    expect(useCompare.getState().homes).toEqual([]);
    expect(await screen.findAllByRole('button', { name: 'اختار وحدة' })).toHaveLength(2);
  });
});
