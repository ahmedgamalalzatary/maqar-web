import { fireEvent, screen } from '@testing-library/react-native';
import { fmtNum } from '@maqar/shared';
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
});
