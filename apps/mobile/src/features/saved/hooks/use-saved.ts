import type { PropertyCard } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/toast';
import { m, useT } from '@/core/i18n';
import { useSession } from '@/features/auth/store/session.store';
import { getSaved, saveRequest, unsaveRequest } from '../api/saved.api';

/** The signed-in client's id. Keys the cache, so no account ever sees another's list. */
const useClientId = () => useSession((s) => (s.status === 'signedIn' && s.user?.role === 'client' ? s.user.id : null));

const savedKey = (clientId: number | null) => ['saved', clientId];

/** The saved homes of the signed-in client. Waits for a client: guests and other roles have none. */
export function useSaved<T = PropertyCard[]>(select?: (cards: PropertyCard[]) => T) {
  const clientId = useClientId();
  return useQuery({
    queryKey: savedKey(clientId),
    queryFn: ({ signal }) => getSaved(signal),
    enabled: clientId !== null,
    select,
  });
}

/** The list with `card` put in (at `at`, or first) or taken out. */
export const withSaved = (cards: PropertyCard[] | undefined, card: PropertyCard, on: boolean, at = 0) => {
  const others = (cards ?? []).filter((c) => c.id !== card.id);
  if (!on) return others;
  const i = Math.min(Math.max(0, at), others.length);
  return [...others.slice(0, i), card, ...others.slice(i)];
};

type Change = { card: PropertyCard; on: boolean; at?: number };

/**
 * Saving and taking off any home: the screen changes first, then the server. `at` puts a home
 * back where it was (the Saved list's undo, 2026-11-16).
 */
export function useSetSaved() {
  const t = useT();
  const queryClient = useQueryClient();
  const key = savedKey(useClientId());

  const mutation = useMutation({
    mutationKey: ['saved'],
    // One at a time: a quick save then remove must reach the server in that order.
    scope: { id: 'saved' },
    mutationFn: ({ card, on }: Change) => (on ? saveRequest(card.id) : unsaveRequest(card.id)),
    onMutate: async ({ card, on, at }: Change) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<PropertyCard[]>(key)?.findIndex((c) => c.id === card.id) ?? -1;
      queryClient.setQueryData<PropertyCard[]>(key, (cards) => withSaved(cards, card, on, at));
      return { before };
    },
    onError: (_err, { card, on }, ctx) => {
      queryClient.setQueryData<PropertyCard[]>(key, (cards) => withSaved(cards, card, !on, ctx?.before ?? 0));
      toast.show({ title: t(m.common.weCouldntSaveThatTry), tone: 'danger' });
    },
    onSettled: () => {
      // Refresh after the last write only: an earlier answer must not undo a later tap on screen.
      if (queryClient.isMutating({ mutationKey: ['saved'] }) === 1) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return (card: PropertyCard, on: boolean, at?: number) => mutation.mutate({ card, on, at });
}

/** The heart: whether this home is saved, and the switch. */
export function useToggleSaved(card: PropertyCard) {
  const set = useSetSaved();
  const saved = useSaved((cards) => cards.some((c) => c.id === card.id)).data ?? false;
  return { saved, toggle: () => set(card, !saved) };
}
