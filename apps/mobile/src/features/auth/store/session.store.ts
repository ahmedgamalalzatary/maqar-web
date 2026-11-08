import type { AuthResponse, Me, Role } from '@maqar/shared';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { ApiError, setAuthHandlers } from '@/core/api/api';
import { refreshRequest } from '../api/auth.api';

const REFRESH_KEY = 'maqar.refreshToken';

type Status = 'loading' | 'guest' | 'signedIn';

type Session = {
  status: Status;
  user: Me | null;
  /** Kept in memory only. */
  accessToken: string | null;
  /** Also kept in the phone's secure storage, so the session survives a restart. */
  refreshToken: string | null;
  setSession: (auth: AuthResponse) => Promise<void>;
  setUser: (user: Me) => void;
  clear: () => Promise<void>;
  /** Swaps the refresh token for a new pair. False when the session is over. */
  refresh: () => Promise<boolean>;
  /** On app start: resume the saved session, if any. */
  restore: () => Promise<void>;
};

export const useSession = create<Session>((set, get) => ({
  status: 'loading',
  user: null,
  accessToken: null,
  refreshToken: null,

  async setSession({ user, accessToken, refreshToken }) {
    set({ status: 'signedIn', user, accessToken, refreshToken });
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  },

  setUser(user) {
    set({ user });
  },

  async clear() {
    set({ status: 'guest', user: null, accessToken: null, refreshToken: null });
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },

  async refresh() {
    const token = get().refreshToken;
    if (!token) return false;
    try {
      await get().setSession(await refreshRequest(token));
      return true;
    } catch {
      return false;
    }
  },

  async restore() {
    const token = await SecureStore.getItemAsync(REFRESH_KEY);
    if (!token) return set({ status: 'guest' });
    try {
      await get().setSession(await refreshRequest(token));
    } catch (err) {
      // Offline: keep the saved token for the next launch. Rejected: forget it.
      if (err instanceof ApiError && err.status === 401) await get().clear();
      else set({ status: 'guest' });
    }
  },
}));

setAuthHandlers({
  getAccessToken: () => useSession.getState().accessToken,
  refresh: () => useSession.getState().refresh(),
  onAuthFailure: () => void useSession.getState().clear(),
});

/** Where each role lands after sign-in (contract §2). */
export function homeFor(role: Role): '/' | '/owner' | '/agent' | '/admin' {
  return ({ client: '/', owner: '/owner', agent: '/agent', admin: '/admin' } as const)[role];
}
