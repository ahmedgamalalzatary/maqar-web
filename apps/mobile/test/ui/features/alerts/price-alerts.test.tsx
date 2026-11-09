import type { PropertyCard } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { FollowPriceButton } from '@/features/alerts/components/follow-price-button';
import { useAuthPrompt } from '@/features/auth/components/auth-prompt';
import { useSession } from '@/features/auth/store/session.store';
import { SavedScreen } from '@/features/saved/screens/saved-screen';
import { jsonResponse, makeAuth, makeCard, mockFetch, page } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const home = makeCard({ id: 4, titleAr: 'فيلا في التجمع' });
const dropped = makeCard({ id: 5, titleAr: 'شاليه صف أول', price: 11_400_000, oldPrice: 12_000_000 });
const stay = makeCard({ id: 6, titleAr: 'شاليه بالليلة', category: 'stay', price: 4_000, oldPrice: 5_000 });

/** A small alerts server: remembers follows; returns the writes as "METHOD /path". */
function serve(start: PropertyCard[] = [], drops: PropertyCard[] = [dropped, stay]) {
  let followed = [...start];
  const all = [home, dropped, stay];
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '').split('?')[0]!;
    const method = init.method ?? 'GET';
    if (path === '/alerts') return jsonResponse(200, followed);
    if (path === '/favorites') return jsonResponse(200, []);
    if (path === '/properties') return jsonResponse(200, page(drops));
    const one = /^\/alerts\/(\d+)$/.exec(path);
    if (one && method === 'PUT') followed = [all.find((c) => c.id === Number(one[1]))!, ...followed.filter((c) => c.id !== Number(one[1]))];
    if (one && method === 'DELETE') followed = followed.filter((c) => c.id !== Number(one[1]));
    return jsonResponse(204);
  });
  return () =>
    fetchMock.mock.calls
      .map(([url, init]: [string, RequestInit]) => `${init.method ?? 'GET'} ${url.replace(/^.*\/v1/, '').split('?')[0]}`)
      .filter((c) => !c.startsWith('GET'));
}

beforeEach(async () => {
  jest.clearAllMocks();
  useAuthPrompt.setState({ open: false });
  await useSession.getState().clear();
});

describe('Follow price on the property page', () => {
  it('asks a guest to sign in first', async () => {
    const writes = serve();
    await renderWithProviders(<FollowPriceButton card={home} />);
    await fireEvent.press(screen.getByRole('button', { name: 'نبهني لو نزل' }));
    expect(useAuthPrompt.getState().open).toBe(true);
    expect(writes()).toEqual([]);
  });

  it('follows and unfollows for a client', async () => {
    await useSession.getState().setSession(makeAuth());
    const writes = serve();
    await renderWithProviders(<FollowPriceButton card={home} />);
    await fireEvent.press(await screen.findByRole('button', { name: 'نبهني لو نزل', selected: false }));
    expect(await screen.findByRole('button', { name: 'متابع السعر', selected: true })).toBeOnTheScreen();
    await waitFor(() => expect(writes()).toEqual(['PUT /alerts/4']));
    await fireEvent.press(screen.getByRole('button', { name: 'متابع السعر' }));
    expect(await screen.findByRole('button', { name: 'نبهني لو نزل' })).toBeOnTheScreen();
    await waitFor(() => expect(writes()).toEqual(['PUT /alerts/4', 'DELETE /alerts/4']));
  });

  it('shows a followed home as followed', async () => {
    await useSession.getState().setSession(makeAuth());
    serve([home]);
    await renderWithProviders(<FollowPriceButton card={home} />);
    expect(await screen.findByRole('button', { name: 'متابع السعر' })).toBeOnTheScreen();
  });

  it('is not there for staff, or for a stay', async () => {
    serve();
    const view = await renderWithProviders(<FollowPriceButton card={stay} />);
    expect(screen.queryByRole('button', { name: 'نبهني لو نزل' })).toBeNull();
    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    await view.rerender(<FollowPriceButton card={home} />);
    expect(screen.queryByRole('button', { name: 'نبهني لو نزل' })).toBeNull();
  });
});

describe('Saved: price alerts', () => {
  const openAlerts = async () => {
    await renderWithProviders(<SavedScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'تنبيهات السعر' }));
  };

  it('lists followed homes first, then other homes whose price fell, never stays', async () => {
    await useSession.getState().setSession(makeAuth());
    serve([home]);
    await openAlerts();
    const rows = await screen.findAllByRole('button', { name: /فيلا في التجمع|شاليه/ });
    expect(rows.map((r) => r.props.accessibilityLabel)).toEqual(['فيلا في التجمع', 'شاليه صف أول']);
    const switches = screen.getAllByLabelText('تنبيه السعر');
    expect(switches.map((s) => s.props.value)).toEqual([true, false]);
    expect(screen.getByText('٥٪-')).toBeOnTheScreen();
  });

  it('turns an alert on and off from its switch', async () => {
    await useSession.getState().setSession(makeAuth());
    const writes = serve([]);
    await openAlerts();
    const sw = await screen.findByLabelText('تنبيه السعر');
    await fireEvent(sw, 'valueChange', true);
    await waitFor(() => expect(writes()).toEqual(['PUT /alerts/5']));
    await waitFor(() => expect(screen.getByLabelText('تنبيه السعر')).toHaveProp('value', true));
    await fireEvent(screen.getByLabelText('تنبيه السعر'), 'valueChange', false);
    await waitFor(() => expect(writes()).toEqual(['PUT /alerts/5', 'DELETE /alerts/5']));
  });

  it('has an empty state, and asks a guest to sign in', async () => {
    await useSession.getState().setSession(makeAuth());
    serve([], []);
    const view = await renderWithProviders(<SavedScreen />);
    await fireEvent.press(screen.getByRole('radio', { name: 'تنبيهات السعر' }));
    expect(await screen.findByText('مفيش تنبيهات أسعار لسه')).toBeOnTheScreen();
    await view.unmount();

    await useSession.getState().clear();
    await openAlerts();
    expect(screen.getByText('سجّل دخولك عشان تتابع الأسعار')).toBeOnTheScreen();
  });
});
