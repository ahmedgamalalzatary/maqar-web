import { type BookViewingBody, isUpcoming, type UpdateViewingBody, type ViewingItem } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/store/session.store';
import { notificationsKey } from '@/features/notifications/hooks/use-notifications';
import { bookRequest, getSlots, getViewings, updateViewingRequest } from '../api/viewings.api';

/** The signed-in client's id. Keys the cache, so no account ever sees another's list. */
const useClientId = () => useSession((s) => (s.status === 'signedIn' && s.user?.role === 'client' ? s.user.id : null));
/** Every account's viewings: what a booking elsewhere (the chat) makes stale. */
export const VIEWINGS_KEY = ['viewings'];
const viewingsKey = (clientId: number | null) => [...VIEWINGS_KEY, clientId];

export function useSlots(propertyId: number, reschedule?: number) {
  return useQuery({
    queryKey: ['slots', propertyId, reschedule ?? null],
    queryFn: ({ signal }) => getSlots(propertyId, reschedule, signal),
    // Hours fill up: check again whenever the screen comes back.
    staleTime: 0,
  });
}

/** The signed-in client's viewings, soonest first. */
export function useViewings<T = ViewingItem[]>(select?: (items: ViewingItem[]) => T) {
  const clientId = useClientId();
  return useQuery({ queryKey: viewingsKey(clientId), queryFn: ({ signal }) => getViewings(signal), enabled: clientId !== null, select });
}

/** For the Viewings tab badge and Home's "Your next viewing". */
export function useUpcoming(): ViewingItem[] {
  return useViewings((items) => items.filter((v) => isUpcoming(v))).data ?? [];
}

/** After any change: the list, the hours and the inbox (a confirmation arrives) are stale. */
function useAfterChange() {
  const queryClient = useQueryClient();
  const key = viewingsKey(useClientId());
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: ['slots'] }),
      queryClient.invalidateQueries({ queryKey: notificationsKey(useSession.getState().user?.id ?? null) }),
    ]);
}

export function useBook() {
  const after = useAfterChange();
  return useMutation({ mutationFn: (body: BookViewingBody) => bookRequest(body), onSettled: after });
}

export function useUpdateViewing() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UpdateViewingBody }) => updateViewingRequest(id, body),
    onSettled: after,
  });
}
