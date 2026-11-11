import { screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useSession } from '@/features/auth/store/session.store';
import { useUnreadCount } from '@/features/notifications/hooks/use-notifications';
import { useRecommended } from '@/features/prefs/hooks/use-prefs';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';

const Probe = () => <Text>unread:{useUnreadCount()}</Text>;
const Picks = () => {
  const rec = useRecommended(true);
  return <Text>picks:{rec.data?.length ?? 'none'}</Text>;
};

const auth = (n: number) => ({ ...makeAuth({ id: n, name: `User ${n}` }), accessToken: `access-${n}`, refreshToken: `refresh-${n}-1234567890` });

async function signInAs(n: number) {
  await useSession.getState().clear();
  await useSession.getState().setSession(auth(n));
}

describe('per-account caches', () => {
  it("never shows one account inbox to another after an automatic switch", async () => {
    mockFetch().mockImplementation(async (url: string, init?: RequestInit) => {
      const token = new Headers(init?.headers).get('authorization');
      if (token === 'Bearer access-1') return jsonResponse(200, { items: [{ id: 1, kind: 'system', read: false }], unread: 3 });
      return jsonResponse(200, { items: [], unread: 0 });
    });
    await signInAs(1);
    await renderWithProviders(<Probe />);
    expect(await screen.findByText('unread:3')).toBeTruthy();
    // Account 2 signs in on the same running app (the first token expired or was revoked).
    await signInAs(2);
    // While 2's inbox request loads, 1's cached inbox must not be shown.
    expect(screen.getByText('unread:0')).toBeTruthy();
    await screen.findByText('unread:0');
    expect(useSession.getState().user?.id).toBe(2);
  });

  it("never shows one account recommended homes to another", async () => {
    mockFetch().mockImplementation(async (url: string, init?: RequestInit) => {
      const token = new Headers(init?.headers).get('authorization');
      if (token === 'Bearer access-1') return jsonResponse(200, [{ id: 1 }, { id: 2 }]);
      return jsonResponse(200, []);
    });
    await signInAs(1);
    await renderWithProviders(<Picks />);
    expect(await screen.findByText('picks:2')).toBeTruthy();
    await signInAs(2);
    expect(await screen.findByText('picks:0')).toBeTruthy();
  });
});

