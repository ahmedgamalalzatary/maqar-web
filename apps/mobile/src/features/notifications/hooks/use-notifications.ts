import type { NotificationsResponse } from '@maqar/shared';
import type { InfiniteData } from '@tanstack/react-query';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/features/auth/store/session.store';
import { listNotifications, olderCursor, readAllRequest, readOneRequest } from '../api/notifications.api';

type Box = NotificationsResponse;
type Inbox = InfiniteData<Box>;

/** The inbox is cached per account, so no user ever sees another's notifications. */
export const notificationsKey = (userId: number | null) => ['notifications', userId] as const;
const useMyNotificationsKey = () => notificationsKey(useSession((s) => s.user?.id ?? null));

/**
 * The signed-in user's inbox, the newest first, older pages as the list scrolls down. It refreshes
 * every minute while the app is open, and when a push lands.
 */
export function useNotifications() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  const key = useMyNotificationsKey();
  return useInfiniteQuery({
    queryKey: key,
    queryFn: ({ pageParam, signal }) => listNotifications(pageParam, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last, all) => olderCursor(all),
    enabled: signedIn,
    refetchInterval: 60_000,
  });
}

/** For the bell and the Alerts tab. */
export function useUnreadCount(): number {
  return useNotifications().data?.pages[0]?.unread ?? 0;
}

/** Changes the cached inbox at once, then lets the server's answer win. */
function useInboxMutation(mutationFn: (id?: number) => Promise<void>, change: (box: Box, id?: number) => Box) {
  const queryClient = useQueryClient();
  const key = useMyNotificationsKey();
  return useMutation({
    mutationFn,
    onMutate: async (id?: number) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<Inbox>(key);
      if (before)
        queryClient.setQueryData<Inbox>(key, { ...before, pages: before.pages.map((p) => change(p, id)) });
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
      const unread = box.items.some((n) => n.id === id && !n.read) ? Math.max(0, box.unread - 1) : box.unread;
      return { items: box.items.map((n) => (n.id === id ? { ...n, read: true } : n)), unread };
    },
  );
}

export function useMarkAllRead() {
  return useInboxMutation(
    () => readAllRequest(),
    (box) => ({ items: box.items.map((n) => ({ ...n, read: true })), unread: 0 }),
  );
}
