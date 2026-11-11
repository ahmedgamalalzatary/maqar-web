import * as SecureStore from 'expo-secure-store';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';

describe('session refresh', () => {
  beforeEach(async () => {
    await useSession.getState().setSession(makeAuth());
  });

  it('keeps the saved session when the refresh fails for lack of connection', async () => {
    mockFetch().mockRejectedValue(new TypeError('Network request failed'));
    await expect(useSession.getState().refresh()).rejects.toMatchObject({ status: 0 });
    expect(useSession.getState().user).not.toBeNull();
    expect(await SecureStore.getItemAsync('maqar.refreshToken')).toBe('refresh-token-1234567890');
  });

  it('reports the session as over when the server rejects the refresh token', async () => {
    mockFetch().mockResolvedValue(jsonResponse(401, { statusCode: 401, message: 'Session expired' }));
    await expect(useSession.getState().refresh()).resolves.toBe(false);
  });

  it('does not sign back in when a slow refresh finishes after sign-out', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((r) => (release = r));
    mockFetch().mockImplementation(async () => {
      await gate;
      return jsonResponse(200, { ...makeAuth(), accessToken: 'access-new', refreshToken: 'refresh-new-1234567890' });
    });
    const pending = useSession.getState().refresh();
    await useSession.getState().clear();
    release!();
    await expect(pending).resolves.toBe(false);
    expect(useSession.getState().status).toBe('guest');
    expect(useSession.getState().refreshToken).toBeNull();
    expect(await SecureStore.getItemAsync('maqar.refreshToken')).toBeNull();
  });

  it('does not overwrite a newer session when a slow refresh finishes after another sign-in', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((r) => (release = r));
    let calls = 0;
    mockFetch().mockImplementation(async () => {
      calls += 1;
      await gate;
      return jsonResponse(200, { ...makeAuth(), accessToken: `access-old-${calls}`, refreshToken: `refresh-old-${calls}-1234567890` });
    });
    const stale = useSession.getState().refresh();
    // A different account signs in while the first refresh is still waiting.
    const other = { ...makeAuth({ id: 2, name: 'Other' }), accessToken: 'access-other', refreshToken: 'refresh-other-1234567890' };
    await useSession.getState().setSession(other);
    release!();
    await expect(stale).resolves.toBe(false);
    expect(useSession.getState().user?.id).toBe(2);
    expect(useSession.getState().accessToken).toBe('access-other');
  });
});
