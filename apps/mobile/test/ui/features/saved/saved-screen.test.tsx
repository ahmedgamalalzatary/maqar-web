import type { PropertyCard } from '@maqar/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { SavedScreen } from '@/features/saved/screens/saved-screen';
import { jsonResponse, makeCard, makeMe, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const villa = makeCard({ id: 7 });
const flat = makeCard({ id: 8, titleAr: 'شقة مفروشة للإيجار', titleEn: 'Furnished flat' });

/** A small server: GET /favorites answers the saved list unless `fail` is set; removals change the list. */
function api(start: PropertyCard[] = [], state: { fail?: boolean } = {}) {
  let saved = start;
  return mockFetch().mockImplementation(async (url: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') saved = saved.filter((c) => !url.endsWith(`/favorites/${c.id}`));
    if (init?.method === 'PUT' || init?.method === 'DELETE') return jsonResponse(204);
    if (state.fail) return jsonResponse(500, { statusCode: 500, message: 'Boom' });
    return url.endsWith('/favorites') ? jsonResponse(200, saved) : jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
}

const signIn = () => useSession.setState({ status: 'signedIn', user: makeMe({ role: 'client' }), accessToken: 'access' });

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

describe('The Saved tab', () => {
  it('asks a guest to sign in, without calling the API', async () => {
    const fetchMock = api();
    await renderWithProviders(<SavedScreen />);

    expect(screen.getByRole('header', { name: 'المحفوظة' })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الدخول' }));

    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lists the saved homes in the order the server gives, and opens one', async () => {
    signIn();
    api([flat, villa]);
    await renderWithProviders(<SavedScreen />);

    const first = await screen.findByRole('button', { name: flat.titleAr });
    expect(screen.getByRole('button', { name: villa.titleAr })).toBeOnTheScreen();
    expect(screen.getAllByRole('button', { name: 'شيل من المحفوظة', selected: true })).toHaveLength(2);

    await fireEvent.press(first);
    expect(mockRouter.push).toHaveBeenCalledWith('/property/8');
  });

  it('takes a home off the list straight away when its heart is tapped', async () => {
    signIn();
    api([flat, villa]);
    await renderWithProviders(<SavedScreen />);
    await screen.findByRole('button', { name: flat.titleAr });

    await fireEvent.press(screen.getAllByRole('button', { name: 'شيل من المحفوظة' })[0]!);

    await waitFor(() => expect(screen.queryByRole('button', { name: flat.titleAr })).toBeNull());
  });

  it('shows the empty state, which leads to Explore', async () => {
    signIn();
    api([]);
    await renderWithProviders(<SavedScreen />);

    expect(await screen.findByText('لسه محفظتش حاجة')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'استكشف' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/explore');
  });

  it('offers a retry when the list cannot load, not the empty state', async () => {
    signIn();
    const state = { fail: true };
    api([villa], state);
    await renderWithProviders(<SavedScreen />);

    const retry = await screen.findByRole('button', { name: 'حاول تاني' });
    expect(screen.queryByText('لسه محفظتش حاجة')).toBeNull();

    state.fail = false;
    await fireEvent.press(retry);
    expect(await screen.findByRole('button', { name: villa.titleAr })).toBeOnTheScreen();
  });
});
