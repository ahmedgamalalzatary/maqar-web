import { type ListingFacets, fmtNum, type PropertyCard, priceScale, SIZE_SCALE } from '@maqar/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { ExploreScreen } from '@/features/listings/screens/explore-screen';
import { AREAS, makeCard, makeMe, mockFetch, page, queryOf, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const villa = makeCard({ id: 1 });
const flat = makeCard({ id: 2, category: 'rent', type: 'apartment', titleAr: 'شقة مفروشة للإيجار', titleEn: 'Furnished flat', price: 45_000, beds: 2 });

const list = (v: string | null) => (v ? v.split(',') : []);

/** Like the API, for the filters these tests use. */
function matches(c: PropertyCard, q: URLSearchParams) {
  const types = list(q.get('type'));
  const beds = list(q.get('beds')).map(Number);
  const areas = list(q.get('area'));
  return (
    (!q.get('category') || c.category === q.get('category')) &&
    (!areas.length || areas.includes(c.area.id)) &&
    (!types.length || types.includes(c.type)) &&
    (!beds.length || beds.some((b) => (b === 5 ? c.beds >= 5 : c.beds === b))) &&
    (!q.get('plan') || c.plan !== null) &&
    (!q.get('q') || `${c.titleAr} ${c.titleEn} ${c.compoundEn}`.toLowerCase().includes(q.get('q')!.toLowerCase()))
  );
}

function api(cards = [villa, flat], limit = 20) {
  return routeFetch({
    '/areas': () => AREAS,
    '/properties': (q) => {
      const hits = cards
        .filter((c) => matches(c, q))
        .map((c) => (q.get('sort') === 'match' ? { ...c, match: { score: 90 - c.id, reasons: [{ ar: 'ضمن ميزانيتك', en: 'Within budget' }] } } : c));
      const n = Number(q.get('page') ?? 1);
      return page(hits.slice((n - 1) * limit, n * limit), { page: n, limit, total: hits.length });
    },
    '/properties/facets': (q): ListingFacets => {
      const scale = priceScale((q.get('category') ?? undefined) as PropertyCard['category'] | undefined);
      return {
        total: cards.filter((c) => matches(c, q)).length,
        price: { ...scale, counts: Array(28).fill(0) },
        size: { ...SIZE_SCALE, counts: Array(28).fill(0) },
        deliveryYears: [2027, 2028],
      };
    },
  });
}

/** The query of the latest list request (not the facets). */
function lastListQuery(fetchMock: jest.Mock) {
  const calls = fetchMock.mock.calls.map((_, i) => i).filter((i) => /\/properties(\?|$)/.test(String(fetchMock.mock.calls[i][0])));
  return queryOf(fetchMock, calls[calls.length - 1]);
}
const firstListQuery = (fetchMock: jest.Mock) =>
  queryOf(fetchMock, fetchMock.mock.calls.findIndex(([u]) => /\/properties(\?|$)/.test(String(u))));

async function openFilters() {
  await fireEvent.press(screen.getByRole('button', { name: 'الفلاتر' }));
  expect(await screen.findByRole('header', { name: 'الفلاتر' })).toBeOnTheScreen();
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

describe('ExploreScreen', () => {
  it('lists the approved homes from the API', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);

    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();
    expect(screen.getByText('شقة مفروشة للإيجار')).toBeOnTheScreen();
    expect(firstListQuery(fetchMock)).toEqual({ page: '1', limit: '20' });
  });

  it('switches category with the tabs', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('فيلا مستقلة بحمام سباحة خاص');

    await fireEvent.press(screen.getByRole('tab', { name: 'للإيجار' }));

    await waitFor(() => expect(screen.queryByText('فيلا مستقلة بحمام سباحة خاص')).not.toBeOnTheScreen());
    expect(screen.getByText('شقة مفروشة للإيجار')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'للإيجار' })).toBeSelected();
    expect(lastListQuery(fetchMock)).toMatchObject({ category: 'rent' });
  });

  it('opens on the category Home sent it to', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen category="rent" />);

    expect(await screen.findByText('شقة مفروشة للإيجار')).toBeOnTheScreen();
    expect(screen.getByRole('tab', { name: 'للإيجار' })).toBeSelected();
    expect(firstListQuery(fetchMock)).toMatchObject({ category: 'rent' });
  });

  it('filters by the area picked on Home, and the filter can be cleared', async () => {
    const zayed = makeCard({ id: 3, titleAr: 'توين هاوس بحديقة', area: { id: 'zayed', nameAr: 'الشيخ زايد', nameEn: 'Sheikh Zayed' } });
    const fetchMock = api([villa, zayed]);
    await renderWithProviders(<ExploreScreen area="zayed" />);

    expect(await screen.findByText('توين هاوس بحديقة')).toBeOnTheScreen();
    expect(screen.queryByText('فيلا مستقلة بحمام سباحة خاص')).not.toBeOnTheScreen();
    expect(firstListQuery(fetchMock)).toMatchObject({ area: 'zayed' });

    await fireEvent.press(await screen.findByRole('button', { name: 'شيل فلتر الشيخ زايد' }));
    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();
  });

  it('searches as you type, once typing pauses', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');

    await fireEvent.changeText(screen.getByLabelText('بحث'), 'pool');

    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ q: 'pool' }));
    expect(await screen.findByText('فيلا مستقلة بحمام سباحة خاص')).toBeOnTheScreen();
    await waitFor(() => expect(screen.queryByText('شقة مفروشة للإيجار')).not.toBeOnTheScreen());

    await fireEvent.press(screen.getByRole('button', { name: 'امسح البحث' }));
    await waitFor(() => expect(lastListQuery(fetchMock)).not.toHaveProperty('q'));
  });

  it('turns a quick filter on and off with one tap', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');

    await fireEvent.press(screen.getByRole('checkbox', { name: 'تقسيط' }));
    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ plan: 'true' }));
    expect(screen.getByRole('checkbox', { name: 'تقسيط' })).toBeChecked();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'تقسيط' }));
    await waitFor(() => expect(lastListQuery(fetchMock)).not.toHaveProperty('plan'));
  });

  it('shows only homes with a 360° tour from the first quick filter', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'جولة ٣٦٠°' }));
    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ tour: 'true' }));
  });

  it('sorts by the lowest price', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');

    await fireEvent.press(screen.getByRole('button', { name: 'ترتيب: الأحدث' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الأقل سعراً' }));

    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ sort: 'low' }));
    expect(screen.getByRole('button', { name: 'ترتيب: الأقل سعراً' })).toBeOnTheScreen();
  });

  it('the filter sheet still gets its counts after sorting: the facets request carries no sort', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');
    await fireEvent.press(screen.getByRole('button', { name: 'ترتيب: الأحدث' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الأقل سعراً' }));
    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ sort: 'low' }));

    await openFilters();
    const facetCalls = () => fetchMock.mock.calls.map(([u]) => String(u)).filter((u) => u.includes('/properties/facets'));
    await waitFor(() => expect(facetCalls().length).toBeGreaterThan(0));
    // The API refuses parameters it does not know, so a sort here would be a 400.
    for (const url of facetCalls()) expect(url).not.toMatch(/[?&](sort|page|limit)=/);
  });

  it('a signed-in client sorts by best match, and the cards show how well they match', async () => {
    useSession.setState({ status: 'signedIn', user: makeMe({ role: 'client' }), accessToken: 'access' });
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');
    expect(screen.queryByText(/تطابق/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'ترتيب: الأحدث' }));
    await fireEvent.press(await screen.findByRole('radio', { name: 'الأنسب ليك' }));

    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ sort: 'match' }));
    expect(await screen.findByText(`تطابق ${fmtNum(89, 'ar')}٪`)).toBeOnTheScreen();
    expect(screen.getByText(`تطابق ${fmtNum(88, 'ar')}٪`)).toBeOnTheScreen();
  });

  it('opens on best match when Home sends it there', async () => {
    useSession.setState({ status: 'signedIn', user: makeMe({ role: 'client' }), accessToken: 'access' });
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen sort="match" />);
    await screen.findByText('شقة مفروشة للإيجار');
    expect(firstListQuery(fetchMock)).toMatchObject({ sort: 'match' });
  });

  it('does not offer best match to guests', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen sort="match" />);
    await screen.findByText('شقة مفروشة للإيجار');
    expect(firstListQuery(fetchMock)).not.toHaveProperty('sort');
    await fireEvent.press(screen.getByRole('button', { name: 'ترتيب: الأحدث' }));
    expect(await screen.findByRole('radio', { name: 'الأقل سعراً' })).toBeOnTheScreen();
    expect(screen.queryByRole('radio', { name: 'الأنسب ليك' })).toBeNull();
  });

  it('applies the filter sheet: the button counts the matches first, then the chips show and clear', async () => {
    const big = makeCard({ id: 4, type: 'villa', beds: 6, titleAr: 'فيلا كبيرة' });
    const fetchMock = api([villa, flat, big]);
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');
    await openFilters();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'فيلا' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: `${fmtNum(5, 'ar')}+ غرف` }));
    // From the facets, for the picks so far: both villas have 5 or more bedrooms.
    const show = await screen.findByRole('button', { name: `اعرض ${fmtNum(2, 'ar')} وحدة` });
    expect(lastListQuery(fetchMock)).not.toHaveProperty('type'); // nothing applied yet

    await fireEvent.press(show);

    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ type: 'villa', beds: '5' }));
    await waitFor(() => expect(screen.queryByText('شقة مفروشة للإيجار')).not.toBeOnTheScreen());
    expect(screen.getByRole('button', { name: 'شيل فلتر فيلا' })).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'شيل فلتر فيلا' }));
    await waitFor(() => expect(lastListQuery(fetchMock)).not.toHaveProperty('type'));
    expect(lastListQuery(fetchMock)).toMatchObject({ beds: '5' });

    await fireEvent.press(screen.getByRole('button', { name: 'مسح الفلاتر' }));
    await waitFor(() => expect(lastListQuery(fetchMock)).not.toHaveProperty('beds'));
  });

  it('keeps the filters as they were when the sheet is closed without applying', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('شقة مفروشة للإيجار');
    await openFilters();

    await fireEvent.press(screen.getByRole('checkbox', { name: 'فيلا' }));
    await fireEvent.press(screen.getAllByRole('button', { name: 'إغلاق' })[0]);

    expect(screen.queryByRole('header', { name: 'الفلاتر' })).not.toBeOnTheScreen();
    expect(lastListQuery(fetchMock)).not.toHaveProperty('type');
    expect(screen.queryByRole('button', { name: 'شيل فلتر فيلا' })).not.toBeOnTheScreen();
  });

  it.each([
    ['All', undefined, 'نطاق السعر', 250_000],
    ['Rent', 'rent', 'الإيجار الشهري', 5_000],
    ['Stays', 'stay', 'سعر الليلة', 500],
  ] as const)('moves the price in the steps of the category: %s', async (_name, category, title, step) => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen category={category} />);
    await openFilters();

    expect(screen.getByText(title)).toBeOnTheScreen();
    if (!category) expect(screen.getByText('للبيع والمشروعات')).toBeOnTheScreen();
    const minThumb = screen.getByRole('adjustable', { name: 'أقل سعر' });
    expect(minThumb.props.accessibilityValue).toMatchObject({ min: 0, max: priceScale(category).max, now: 0 });

    await act(() => fireEvent(minThumb, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } }));
    expect(screen.getByRole('adjustable', { name: 'أقل سعر' }).props.accessibilityValue.now).toBe(step);

    await fireEvent.press(await screen.findByRole('button', { name: /^اعرض/ }));
    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ minPrice: String(step) }));
    expect(lastListQuery(fetchMock)).not.toHaveProperty('maxPrice');
  });

  it('takes a typed maximum price in Arabic digits', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen category="rent" />);
    await screen.findByText('شقة مفروشة للإيجار');
    await openFilters();

    const max = screen.getByLabelText('إلى');
    expect(max.props.value).toBe('أي سعر');
    await fireEvent(max, 'focus');
    await fireEvent.changeText(max, '٥٠٬٠٠٠');
    await fireEvent(max, 'blur');
    expect(screen.getByLabelText('إلى').props.value).toBe(fmtNum(50_000, 'ar'));

    await fireEvent.press(await screen.findByRole('button', { name: /^اعرض/ }));
    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ category: 'rent', maxPrice: '50000' }));
  });

  it('takes a typed size range, like the price (2026-11-12)', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await openFilters();

    const min = () => screen.getByLabelText('أقل مساحة بالمتر');
    const max = () => screen.getByLabelText('أكبر مساحة بالمتر');
    expect(min().props.value).toBe(fmtNum(50, 'ar'));
    expect(max().props.value).toBe('أي مساحة');
    await fireEvent(min(), 'focus');
    await fireEvent.changeText(min(), '١٢٠');
    await fireEvent(min(), 'blur');
    await fireEvent(max(), 'focus');
    await fireEvent.changeText(max(), '250');
    await fireEvent(max(), 'blur');
    expect(min().props.value).toBe(fmtNum(120, 'ar'));
    expect(max().props.value).toBe(fmtNum(250, 'ar'));
    // The slider follows the typed numbers.
    expect(screen.getByRole('adjustable', { name: 'أقل مساحة' }).props.accessibilityValue.now).toBe(120);

    await fireEvent.press(await screen.findByRole('button', { name: /^اعرض/ }));
    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ minSize: '120', maxSize: '250' }));
  });

  it('keeps a typed size range in order and drops a maximum past the scale', async () => {
    const fetchMock = api();
    await renderWithProviders(<ExploreScreen />);
    await openFilters();
    const type = async (label: string, text: string) => {
      await fireEvent(screen.getByLabelText(label), 'focus');
      await fireEvent.changeText(screen.getByLabelText(label), text);
      await fireEvent(screen.getByLabelText(label), 'blur');
    };
    await type('أكبر مساحة بالمتر', '200');
    await type('أقل مساحة بالمتر', '300');
    expect(screen.getByLabelText('أقل مساحة بالمتر').props.value).toBe(fmtNum(190, 'ar'));
    await type('أكبر مساحة بالمتر', '900');
    expect(screen.getByLabelText('أكبر مساحة بالمتر').props.value).toBe('أي مساحة');

    await fireEvent.press(await screen.findByRole('button', { name: /^اعرض/ }));
    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ minSize: '190' }));
    expect(lastListQuery(fetchMock)).not.toHaveProperty('maxSize');
  });

  it('offers to clear the filters when nothing matches them', async () => {
    const fetchMock = api([flat]);
    await renderWithProviders(<ExploreScreen category="rent" />);
    await screen.findByText('شقة مفروشة للإيجار');
    await openFilters();
    await fireEvent.press(screen.getByRole('checkbox', { name: 'فيلا' }));
    await fireEvent.press(await screen.findByRole('button', { name: `اعرض ${fmtNum(0, 'ar')} وحدة` }));

    expect(await screen.findByText('مفيش نتايج بالفلاتر دي')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'مسح الفلاتر' }).at(-1)!);
    expect(await screen.findByText('شقة مفروشة للإيجار')).toBeOnTheScreen();
    expect(lastListQuery(fetchMock)).toEqual({ category: 'rent', page: '1', limit: '20' });
  });

  it('loads the next page at the end of the list', async () => {
    const many = Array.from({ length: 25 }, (_, i) => makeCard({ id: i + 1, titleAr: `وحدة ${i + 1}` }));
    const fetchMock = api(many);
    await renderWithProviders(<ExploreScreen />);
    await screen.findByText('وحدة 1');

    await fireEvent(screen.getByTestId('explore-list'), 'onEndReached');

    await waitFor(() => expect(lastListQuery(fetchMock)).toMatchObject({ page: '2' }));
  });

  it('says so when there are no homes at all', async () => {
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
