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
});
