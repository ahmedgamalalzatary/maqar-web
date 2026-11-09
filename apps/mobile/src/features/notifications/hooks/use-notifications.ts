import type { NotificationsResponse } from '@maqar/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/store/session.store';
import { listNotifications, readAllRequest, readOneRequest } from '../api/notifications.api';

export const NOTIFICATIONS_KEY = ['notifications'] as const;

/** The signed-in user's inbox. It refreshes every minute while the app is open, and when a push lands. */
export function useNotifications() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useQuery({ queryKey: NOTIFICATIONS_KEY, queryFn: listNotifications, enabled: signedIn, refetchInterval: 60_000 });
}

/** For the bell and the Alerts tab. */
export function useUnreadCount(): number {
  return useNotifications().data?.unread ?? 0;
}

/** Changes the cached inbox at once, then lets the server's answer win. */
function useInboxMutation(mutationFn: (id?: number) => Promise<void>, change: (box: NotificationsResponse, id?: number) => NotificationsResponse) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onMutate: async (id?: number) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_KEY });
      const before = queryClient.getQueryData<NotificationsResponse>(NOTIFICATIONS_KEY);
      if (before) queryClient.setQueryData(NOTIFICATIONS_KEY, change(before, id));
      return { before };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.before) queryClient.setQueryData(NOTIFICATIONS_KEY, ctx.before);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY }),
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
