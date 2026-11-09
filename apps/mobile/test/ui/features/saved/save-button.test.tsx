import type { PropertyCard } from '@maqar/shared';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { toast } from '@/components/toast';
import { useAuthPrompt } from '@/features/auth/components/auth-prompt';
import { useSession } from '@/features/auth/store/session.store';
import { PropertyCardView } from '@/features/listings/components/property-card';
import { jsonResponse, makeCard, makeMe, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

const SAVE = 'احفظ الوحدة';
const REMOVE = 'شيل من المحفوظة';
const villa = makeCard({ id: 7 });

/** A small server: GET /favorites answers the saved list; writes change it when `write` answers 2xx. */
function api(start: PropertyCard[] = [], write: () => Promise<Response> | Response = () => jsonResponse(204)) {
  let saved = start;
  const fetchMock = mockFetch().mockImplementation(async (url: string, init?: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '');
    if (init?.method === 'PUT' || init?.method === 'DELETE') {
      const res = await write();
      if (res.ok) saved = init.method === 'PUT' ? [villa, ...saved] : saved.filter((c) => `/favorites/${c.id}` !== path);
      return res;
    }
    return path === '/favorites' ? jsonResponse(200, saved) : jsonResponse(404, { statusCode: 404, message: 'Not found' });
  });
  return fetchMock;
}

const writes = (fetchMock: jest.Mock) =>
  fetchMock.mock.calls
    .map((_, i) => requestOf(fetchMock, i))
    .filter((r) => r.method === 'PUT' || r.method === 'DELETE')
    .map((r) => `${r.method} ${r.path}`);

const signIn = (role: 'client' | 'owner' = 'client', id = 1) =>
  useSession.setState({ status: 'signedIn', user: makeMe({ role, id }), accessToken: 'access' });

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
  useAuthPrompt.setState({ open: false });
});

describe('The heart on a card', () => {
  it('asks a guest to sign in, without calling the API', async () => {
    const fetchMock = api();
    await renderWithProviders(<PropertyCardView card={villa} />);

    await fireEvent.press(screen.getByRole('button', { name: SAVE }));

    expect(useAuthPrompt.getState().open).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is not shown to other roles, who have no saved homes', async () => {
    signIn('owner');
    const fetchMock = api();
    await renderWithProviders(<PropertyCardView card={villa} />);

    expect(screen.queryByRole('button', { name: SAVE })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows a home the client already saved as saved', async () => {
    signIn();
    api([villa]);
    await renderWithProviders(<PropertyCardView card={villa} />);

    expect(await screen.findByRole('button', { name: REMOVE, selected: true })).toBeOnTheScreen();
  });

  it('fills straight away, before the server answers, and does not open the listing', async () => {
    signIn();
    let answer!: (r: Response) => void;
    const fetchMock = api([], () => new Promise((resolve) => (answer = resolve)));
    await renderWithProviders(<PropertyCardView card={villa} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole('button', { name: SAVE }));

    expect(await screen.findByRole('button', { name: REMOVE, selected: true })).toBeOnTheScreen();
    expect(mockRouter.push).not.toHaveBeenCalled();
    await waitFor(() => expect(writes(fetchMock)).toEqual(['PUT /favorites/7']));
    await act(async () => answer(jsonResponse(204)));
  });

  it('removes a saved home', async () => {
    signIn();
    const fetchMock = api([villa]);
    await renderWithProviders(<PropertyCardView card={villa} />);

    await fireEvent.press(await screen.findByRole('button', { name: REMOVE }));

    expect(await screen.findByRole('button', { name: SAVE, selected: false })).toBeOnTheScreen();
    await waitFor(() => expect(writes(fetchMock)).toEqual(['DELETE /favorites/7']));
  });

  it('goes back and says so when saving fails', async () => {
    signIn();
    const show = jest.spyOn(toast, 'show');
    const fetchMock = api([], () => jsonResponse(500, { statusCode: 500, message: 'Boom' }));
    await renderWithProviders(<PropertyCardView card={villa} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole('button', { name: SAVE }));

    await waitFor(() => expect(show).toHaveBeenCalledWith(expect.objectContaining({ tone: 'danger' })));
    expect(await screen.findByRole('button', { name: SAVE, selected: false })).toBeOnTheScreen();
  });

  it('sends quick taps to the server one at a time, in order', async () => {
    signIn();
    const answers: ((r: Response) => void)[] = [];
    const fetchMock = api([], () => new Promise((resolve) => answers.push(resolve)));
    await renderWithProviders(<PropertyCardView card={villa} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await fireEvent.press(screen.getByRole('button', { name: SAVE }));
    await fireEvent.press(await screen.findByRole('button', { name: REMOVE }));
    await screen.findByRole('button', { name: SAVE });

    // The removal waits for the save, so it cannot overtake it on the way to the server.
    await waitFor(() => expect(writes(fetchMock)).toEqual(['PUT /favorites/7']));
    await act(async () => answers[0]!(jsonResponse(204)));
    await waitFor(() => expect(writes(fetchMock)).toEqual(['PUT /favorites/7', 'DELETE /favorites/7']));
    await act(async () => answers[1]!(jsonResponse(204)));
  });

  it('never shows one account the homes of the account before it', async () => {
    signIn('client', 1);
    api([villa]);
    const { unmount } = await renderWithProviders(<PropertyCardView card={villa} />);
    await screen.findByRole('button', { name: REMOVE });
    await unmount();

    // Same phone, session ended without the sign-out flow (rejected token): the guest sees no saved heart.
    await useSession.getState().clear();
    await renderWithProviders(<PropertyCardView card={villa} />);
    expect(screen.getByRole('button', { name: SAVE, selected: false })).toBeOnTheScreen();
  });
});
