import { fireEvent, screen, within } from '@testing-library/react-native';
import { DEFAULT_APP_SETTINGS, fmtMoney, fmtNum, homeSectionOrder } from '@maqar/shared';
import { useAppConfig } from '@/core/app-config/store';
import { useSettings } from '@/core/settings/store';
import { useSession } from '@/features/auth/store/session.store';
import { Home } from '@/features/home/screens/home-screen';
import { AREAS, makeCard, makeMe, page, queryOf, routeFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const launch = makeCard({ id: 9, category: 'project', titleAr: 'شقق بمقدم ١٠٪ وتقسيط ٨ سنوات', plan: { downPct: 10, years: 8 } });

const pick = makeCard({
  id: 4,
  titleAr: 'دوبلكس بجنينة في التجمع',
  match: { score: 87, reasons: [{ ar: 'ضمن ميزانيتك', en: 'Within budget' }, { ar: 'التجمع الخامس', en: 'New Cairo' }] },
});

const dropped = makeCard({ id: 5, titleAr: 'شاليه صف أول في أزور باي', price: 11_400_000, oldPrice: 12_000_000 });

const featured = makeCard({ id: 6, titleAr: 'بنتهاوس مميز على النيل', featured: true });

/** Price drops (`dropped=true`), featured homes and launches answer separately; `drops` and `top` set the first two. */
function api(drops = [dropped], top: typeof featured[] = []) {
  return routeFetch({
    '/areas': () => AREAS,
    '/properties': (q) => page(q.get('dropped') === 'true' ? drops : q.get('featured') === 'true' ? top : [launch]),
    '/properties/recommended': () => [pick],
  });
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
  useAppConfig.setState({ config: DEFAULT_APP_SETTINGS });
});

describe('Home', () => {
  it('shows new launches on installments and the areas, from the API', async () => {
    const fetchMock = api();
    await renderWithProviders(<Home />);

    expect(screen.getByText('واحجز معاينته بنفسك.')).toBeOnTheScreen();
    expect(await screen.findByText('شقق بمقدم ١٠٪ وتقسيط ٨ سنوات')).toBeOnTheScreen();
    expect(await screen.findByText('الشيخ زايد')).toBeOnTheScreen();
    const launches = fetchMock.mock.calls.findIndex(([url]) => String(url).includes('category=project'));
    expect(queryOf(fetchMock, launches)).toMatchObject({ category: 'project', limit: '10' });
  });

  it('lists price drops with the old price and the drop %, and opens one', async () => {
    const fetchMock = api();
    await renderWithProviders(<Home />);
    expect(await screen.findByRole('header', { name: 'السعر نزل' })).toBeOnTheScreen();
    expect(screen.getByText('٥٪-')).toBeOnTheScreen();
    expect(screen.getByText('١٢ مليون ج.م')).toBeOnTheScreen();
    const call = fetchMock.mock.calls.findIndex(([url]) => String(url).includes('dropped=true'));
    expect(queryOf(fetchMock, call)).toMatchObject({ dropped: 'true', limit: '3' });
    await fireEvent.press(screen.getByRole('button', { name: 'شاليه صف أول في أزور باي' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/property/5');
  });

  it('has no price drops section when nothing dropped', async () => {
    api([]);
    await renderWithProviders(<Home />);
    await screen.findByText('شقق بمقدم ١٠٪ وتقسيط ٨ سنوات');
    expect(screen.queryByRole('header', { name: 'السعر نزل' })).toBeNull();
  });

  it('shows the homes the Maqar team featured, and no such row when there are none', async () => {
    api([], [featured]);
    const view = await renderWithProviders(<Home />);
    expect(await screen.findByRole('header', { name: 'مميزة من مقر' })).toBeOnTheScreen();
    expect(screen.getByText('بنتهاوس مميز على النيل')).toBeOnTheScreen();
    await view.unmount();

    api([], []);
    await renderWithProviders(<Home />);
    await screen.findByText(launch.titleAr);
    expect(screen.queryByRole('header', { name: 'مميزة من مقر' })).toBeNull();
  });

  it('leads to the calculator', async () => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'احسب قسطك الشهري' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/calculator');
  });

  it('shows a signed-in client the picks, with match and reasons', async () => {
    useSession.setState({ status: 'signedIn', user: makeMe({ role: 'client' }), accessToken: 'access' });
    const fetchMock = api();
    await renderWithProviders(<Home />);

    expect(await screen.findByText('دوبلكس بجنينة في التجمع')).toBeOnTheScreen();
    expect(screen.getByText('مختارة ليك')).toBeOnTheScreen();
    expect(screen.getByText(`تطابق ${fmtNum(87, 'ar')}٪`)).toBeOnTheScreen();
    expect(screen.getByText('ضمن ميزانيتك')).toBeOnTheScreen();
    expect(screen.getAllByText('التجمع الخامس').length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/properties/recommended'))).toBe(true);

    await fireEvent.press(screen.getByRole('button', { name: 'كل الترشيحات' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/explore', params: { sort: 'match' } });
  });

  it('shows a client what they chose at sign-up, and opens it to edit (2026-11-12)', async () => {
    const prefs = { purpose: ['sale' as const], budgetMax: 8_000_000, areas: ['new-cairo'], types: ['villa' as const], beds: 3, interests: ['pool' as const] };
    useSession.setState({ status: 'signedIn', user: makeMe({ role: 'client', prefs }), accessToken: 'access' });
    api();
    await renderWithProviders(<Home />);

    const box = await screen.findByTestId('my-prefs');
    expect(within(box).getByText('اللي بتدور عليه')).toBeOnTheScreen();
    for (const text of ['للبيع', `لحد ${fmtMoney(8_000_000, 'ar')}`, 'فيلا', `${fmtNum(3, 'ar')}+ غرف`, 'حمام سباحة']) {
      expect(within(box).getByText(text)).toBeOnTheScreen();
    }
    expect(await within(box).findByText('التجمع الخامس')).toBeOnTheScreen();
    await fireEvent.press(within(box).getByRole('button', { name: 'عدّل تفضيلاتك' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');
  });

  it('asks a client who skipped the questions to answer them, and shows a guest nothing', async () => {
    useSession.setState({ status: 'signedIn', user: makeMe({ role: 'client', prefs: null }), accessToken: 'access' });
    api();
    const { unmount } = await renderWithProviders(<Home />);
    const box = await screen.findByTestId('my-prefs');
    await fireEvent.press(within(box).getByRole('button', { name: 'قولنا بتدور على إيه' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');
    await unmount();

    await useSession.getState().clear();
    api();
    await renderWithProviders(<Home />);
    await screen.findByText('شقق بمقدم ١٠٪ وتقسيط ٨ سنوات');
    expect(screen.queryByTestId('my-prefs')).toBeNull();
  });

  it('invites a guest to get picks instead, without asking the API', async () => {
    const fetchMock = api();
    await renderWithProviders(<Home />);
    await screen.findByText('شقق بمقدم ١٠٪ وتقسيط ٨ سنوات');
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/recommended'))).toBe(false);
    await fireEvent.press(screen.getByRole('button', { name: 'ابدأ ترشيحاتك' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-up');
  });

  it.each([
    ['إيجار', 'rent'],
    ['مشروعات', 'project'],
  ])('the %s shortcut opens Explore on that category', async (label, category) => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/explore', params: { category } });
  });

  it('an area opens Explore filtered to it', async () => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(await screen.findByRole('button', { name: 'الشيخ زايد' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/explore', params: { area: 'zayed' } });
  });

  it('the search entry opens Explore', async () => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'منطقة، كمبوند أو نوع الوحدة' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/explore');
  });

  it('switches to dark mode with one tap from the header', async () => {
    api();
    await renderWithProviders(<Home />);
    await fireEvent.press(screen.getByRole('button', { name: 'الوضع الداكن' }));
    expect(useSettings.getState().theme).toBe('dark');
  });

  // Phase 29: an admin orders the sections; the headline and the search box stay on top.
  it('shows the sections in the order the admin set', async () => {
    api();
    const names = () => screen.getAllByRole('header').map((h) => h.props.accessibilityLabel ?? h.props.children).filter((n) => typeof n === 'string');
    const { unmount } = await renderWithProviders(<Home />);
    await screen.findByRole('header', { name: 'السعر نزل' });
    await screen.findByText('شقق بمقدم ١٠٪ وتقسيط ٨ سنوات');
    const before = names();
    expect(before.indexOf('تصفح حسب المنطقة')).toBeLessThan(before.indexOf('مشروعات جديدة بالتقسيط'));
    expect(before.indexOf('السعر نزل')).toBeLessThan(before.indexOf('مشروعات جديدة بالتقسيط'));
    await unmount();

    useAppConfig.setState({ config: { ...DEFAULT_APP_SETTINGS, home: { sections: homeSectionOrder(['launches', 'drops', 'areas']) } } });
    await renderWithProviders(<Home />);
    await screen.findByRole('header', { name: 'السعر نزل' });
    await screen.findByText('شقق بمقدم ١٠٪ وتقسيط ٨ سنوات');
    const after = names();
    expect(after[0]).toBe('لاقي بيتك،');
    expect(after.indexOf('مشروعات جديدة بالتقسيط')).toBeLessThan(after.indexOf('السعر نزل'));
    expect(after.indexOf('السعر نزل')).toBeLessThan(after.indexOf('تصفح حسب المنطقة'));
  });
});
