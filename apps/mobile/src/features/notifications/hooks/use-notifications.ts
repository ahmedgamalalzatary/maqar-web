import type { NotificationsResponse } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/store/session.store';
import { listNotifications, readAllRequest, readOneRequest } from '../api/notifications.api';

/** The inbox is cached per account, so no user ever sees another's notifications. */
export const notificationsKey = (userId: number | null) => ['notifications', userId] as const;
const useMyNotificationsKey = () => notificationsKey(useSession((s) => s.user?.id ?? null));

/** The signed-in user's inbox. It refreshes every minute while the app is open, and when a push lands. */
export function useNotifications() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const key = useMyNotificationsKey();
  return useQuery({ queryKey: key, queryFn: listNotifications, enabled: signedIn, refetchInterval: 60_000 });
}

/** For the bell and the Alerts tab. */
export function useUnreadCount(): number {
  return useNotifications().data?.unread ?? 0;
}

/** Changes the cached inbox at once, then lets the server's answer win. */
function useInboxMutation(mutationFn: (id?: number) => Promise<void>, change: (box: NotificationsResponse, id?: number) => NotificationsResponse) {
  const queryClient = useQueryClient();
  const key = useMyNotificationsKey();
  return useMutation({
    mutationFn,
    onMutate: async (id?: number) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<NotificationsResponse>(key);
      if (before) queryClient.setQueryData(key, change(before, id));
      return { before };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.before) queryClient.setQueryData(key, ctx.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
}

export function useMarkRead() {
  return useInboxMutation(
    (id) => readOneRequest(id!),
    (box, id) => {
      const target = box.items.find((n) => n.id === id);
      if (!target || target.read) return box;
      return { items: box.items.map((n) => (n.id === id ? { ...n, read: true } : n)), unread: Math.max(0, box.unread - 1) };
    },
  );
}

export function useMarkAllRead() {
  return useInboxMutation(
    () => readAllRequest(),
    (box) => ({ items: box.items.map((n) => ({ ...n, read: true })), unread: 0 }),
  );
}
