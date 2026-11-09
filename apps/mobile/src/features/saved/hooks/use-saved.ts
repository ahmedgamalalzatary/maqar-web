import type { PropertyCard } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/toast';
import { useT } from '@/core/i18n';
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

const withSaved = (cards: PropertyCard[] | undefined, card: PropertyCard, on: boolean) => {
  const others = (cards ?? []).filter((c) => c.id !== card.id);
  return on ? [card, ...others] : others;
};

/** The heart: whether this home is saved, and the switch. The screen changes first, then the server. */
export function useToggleSaved(card: PropertyCard) {
  const t = useT();
  const queryClient = useQueryClient();
  const key = savedKey(useClientId());
  const saved = useSaved((cards) => cards.some((c) => c.id === card.id)).data ?? false;

  const mutation = useMutation({
    mutationKey: ['saved'],
    // One at a time: a quick save then remove must reach the server in that order.
    scope: { id: 'saved' },
    mutationFn: (on: boolean) => (on ? saveRequest(card.id) : unsaveRequest(card.id)),
    onMutate: async (on) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<PropertyCard[]>(key, (cards) => withSaved(cards, card, on));
    },
    onError: (_err, on) => {
      queryClient.setQueryData<PropertyCard[]>(key, (cards) => withSaved(cards, card, !on));
      toast.show({ title: t('مقدرناش نحفظ التغيير، حاول تاني', 'We couldn’t save that, try again'), tone: 'danger' });
    },
    onSettled: () => {
      // Refresh after the last write only: an earlier answer must not undo a later tap on screen.
      if (queryClient.isMutating({ mutationKey: ['saved'] }) === 1) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return { saved, toggle: () => mutation.mutate(!saved) };
}
