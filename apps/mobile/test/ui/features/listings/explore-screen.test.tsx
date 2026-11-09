import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ExploreScreen } from '@/features/listings/screens/explore-screen';
import { AREAS, makeCard, mockFetch, page, queryOf, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const villa = makeCard({ id: 1 });
const flat = makeCard({ id: 2, category: 'rent', titleAr: 'شقة مفروشة للإيجار', titleEn: 'Furnished flat', price: 45_000 });

/** Answers like the API: filters the given cards by category and area, and pages them. */
function api(cards = [villa, flat], limit = 20) {
  return routeFetch({
    '/areas': () => AREAS,
    '/properties': (q) => {
      const hits = cards.filter(
        (c) => (!q.get('category') || c.category === q.get('category')) && (!q.get('area') || c.area.id === q.get('area')),
      );
      const n = Number(q.get('page') ?? 1);
      return page(hits.slice((n - 1) * limit, n * limit), { page: n, limit, total: hits.length });
    },
  });
}

const propertyCalls = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls.map((_, i) => i).filter((i) => String(fetchMock.mock.calls[i][0]).includes('/properties'));

beforeEach(() => jest.clearAllMocks());

describe('ExploreScreen', () => {
  it('lists the approved homes from the API', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);

    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();
    expect(screen.getByText('شقة مفروشة للإيجار')).toBeOnTheScreen();
    expect(queryOf(fetchMock, propertyCalls(fetchMock)[0])).toEqual({ page: '1', limit: '20' });
  });

  it('switches category with the tabs', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('فيلا مستقلة بحمام سباحة خاص');

    await fireEvent.press(screen.getByRole('tab', { name: 'للإيجار' }));

    expect(await screen.findByText('شقة مفروشة للإيجار')).toBeOnTheScreen();
    expect(screen.queryByText('فيلا مستقلة بحمام سباحة خاص')).not.toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'للإيجار' })).toBeSelected();
    const calls = propertyCalls(fetchMock);
    expect(queryOf(fetchMock, calls[calls.length - 1])).toMatchObject({ category: 'rent' });
  });

  it('opens on the category Home sent it to', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen category="rent" />);

    expect(await screen.findByText('شقة مفروشة للإيجار')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'للإيجار' })).toBeSelected();
    expect(queryOf(fetchMock, propertyCalls(fetchMock)[0])).toMatchObject({ category: 'rent' });
  });

  it('filters by the area picked on Home, and the filter can be cleared', async () => {
    const zayed = makeCard({ id: 3, titleAr: 'توين هاوس بحديقة', area: { id: 'zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed' } });
    const fetchMock = api([villa, zayed]);
    await renderWithProviders(<ExploreScreen area="zayed" />);

    expect(await screen.findByText('توين هاوس بحديقة')).toBeOnTheScreen();
    expect(screen.queryByText('فيلا مستقلة بحمام سباحة خاص')).not.toBeOnTheScreen();
    expect(queryOf(fetchMock, propertyCalls(fetchMock)[0])).toMatchObject({ area: 'zayed' });

    await fireEvent.press(await screen.findByRole('button', { name: 'شيل فلتر الشيخ زايد' }));
    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();
  });

  it('loads the next page at the end of the list', async () => {
    const many = Array.from({ length: 25 }, (_, i) => makeCard({ id: i + 1, titleAr: `وحدة ${i + 1}` }));
    const fetchMock = api(many);
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('وحدة 1');

    await fireEvent(screen.getByTestId('explore-list'), 'onEndReached');

    await waitFor(() => {
      const calls = propertyCalls(fetchMock);
      expect(queryOf(fetchMock, calls[calls.length - 1])).toMatchObject({ page: '2' });
    });
  });

  it('says so when nothing matches', async () => {
    api([]);
    await renderWithProviders(<ExploreScreen />);
    expect(await screen.findByText('مفيش وحدات هنا لسه')).toBeOnTheScreen();
  });

  it('offers a retry when the API cannot be reached', async () => {
    const fetchMock = mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await renderWithProviders(<ExploreScreen />);

    await fireEvent.press(await screen.findByRole('button', { name: 'حاول تاني' }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(2));
  });
});
