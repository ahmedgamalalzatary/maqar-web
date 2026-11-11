import type { Prefs } from '@maqar/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { updateMeRequest } from '@/features/account/api/me.api';
import { useSession } from '@/features/auth/store/session.store';
import { getMatchCount, getRecommended, savePrefsRequest } from '../api/prefs.api';

/** True for a signed-in client: picks and best match are theirs only. */
export const useIsClient = () => useSession((s) => s.status === 'signedIn' && s.user?.role === 'client');

/** Saves the preferences (and a changed name), then refreshes everything scored by them. */
export function useSavePrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ prefs, name }: { prefs: Prefs; name?: string }) => {
      const me = name ? await updateMeRequest({ name }) : undefined;
      await savePrefsRequest(prefs);
      return { me, prefs };
    },
    onSuccess: ({ me, prefs }) => {
      const user = me ?? useSession.getState().user;
      if (user) useSession.getState().setUser({ ...user, prefs });
      void queryClient.invalidateQueries({ queryKey: ['properties'] });
    },
  });
}

/** "Picked for you" on Home, cached per account so no user sees another's picks. */
export const useRecommended = (enabled: boolean) => {
  const userId = useSession((s) => s.user?.id ?? null);
  return useQuery({ queryKey: ['properties', 'recommended', userId], queryFn: ({ signal }) => getRecommended(signal), enabled });
};

/** Onboarding's live count. The last number stays while the next one loads. */
export const useMatchCount = (prefs: Prefs) =>
  useQuery({
    queryKey: ['properties', 'match-count', prefs],
    queryFn: ({ signal }) => getMatchCount(prefs, signal),
    placeholderData: keepPreviousData,
  });
