import type { PropertyCard } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/components/toast';
import { useT } from '@/core/i18n';
import { useSession } from '@/features/auth/store/session.store';
import { followRequest, getAlerts, unfollowRequest } from '../api/alerts.api';

/** The signed-in client's id. Keys the cache, so no account ever sees another's list. */
const useClientId = () => useSession((s) => (s.status === 'signedIn' && s.user?.role === 'client' ? s.user.id : null));

const alertsKey = (clientId: number | null) => ['alerts', clientId];

/** The homes whose price the signed-in client follows. Waits for a client: other roles have none. */
export function useAlerts<T = PropertyCard[]>(select?: (cards: PropertyCard[]) => T) {
  const clientId = useClientId();
  return useQuery({
    queryKey: alertsKey(clientId),
    queryFn: ({ signal }) => getAlerts(signal),
    enabled: clientId !== null,
    select,
  });
}

const withFollowed = (cards: PropertyCard[] | undefined, card: PropertyCard, on: boolean) => {
  const others = (cards ?? []).filter((c) => c.id !== card.id);
  return on ? [card, ...others] : others;
};

/** "Follow price": whether this home is followed, and the switch. The screen changes first, then the server. */
export function useToggleAlert(card: PropertyCard) {
  const t = useT();
  const queryClient = useQueryClient();
  const key = alertsKey(useClientId());
  const following = useAlerts((cards) => cards.some((c) => c.id === card.id)).data ?? false;

  const mutation = useMutation({
    mutationKey: ['alerts'],
    // One at a time: a quick follow then unfollow must reach the server in that order.
    scope: { id: 'alerts' },
    mutationFn: (on: boolean) => (on ? followRequest(card.id) : unfollowRequest(card.id)),
    onMutate: async (on) => {
      await queryClient.cancelQueries({ queryKey: key });
      queryClient.setQueryData<PropertyCard[]>(key, (cards) => withFollowed(cards, card, on));
      toast.show(
        on
          ? { title: t('هنبلغك لو السعر نزل', 'We’ll tell you if the price drops'), tone: 'sage' }
          : { title: t('تم إيقاف تنبيه السعر', 'Price alert off'), tone: 'sage' },
      );
    },
    onError: (_err, on) => {
      queryClient.setQueryData<PropertyCard[]>(key, (cards) => withFollowed(cards, card, !on));
      toast.show({ title: t('مقدرناش نحفظ التغيير، حاول تاني', 'We couldn’t save that, try again'), tone: 'danger' });
    },
    onSettled: () => {
      // Refresh after the last write only: an earlier answer must not undo a later tap on screen.
      if (queryClient.isMutating({ mutationKey: ['alerts'] }) === 1) void queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return { following, toggle: () => mutation.mutate(!following) };
}
