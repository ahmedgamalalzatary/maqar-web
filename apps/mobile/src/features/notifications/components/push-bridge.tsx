import { useQueryClient } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { useSession } from '@/features/auth/store/session.store';
import { readOneRequest } from '../api/notifications.api';
import { notificationsKey, useUnreadCount } from '../hooks/use-notifications';
import { pushSupported, registerThisPhone, safeHref } from '../push';

// While the app is open a push still shows as a banner; the inbox refreshes as well.
// The web has no phone pushes (expo-notifications throws there), so none of this runs on it.
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true }),
  });
}

/**
 * Connects phone pushes to the app (contract §8.13): keeps this phone's token on the account,
 * refreshes the inbox when a push lands, opens the push's screen when it is tapped (also when the
 * tap started the app), and keeps the app icon's badge at the unread count. Render once, at the root.
 */
export const PushBridge = Platform.OS === 'web' ? () => null : NativePushBridge;

function NativePushBridge() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const status = useSession((s) => s.status);
  const userId = useSession((s) => s.user?.id);
  const pushEnabled = useSession((s) => s.user?.pushEnabled);
  const unread = useUnreadCount();
  const response = Notifications.useLastNotificationResponse();
  const opened = useRef<string | null>(null);

  // Tokens can change, so send it again on every launch and sign-in. It is sent even when the
  // account turned pushes off (the server then sends none): the token moves to whoever is signed
  // in, so a session that ended without signing out cannot leave this phone on the last account.
  useEffect(() => {
    if (status === 'signedIn' && pushSupported()) registerThisPhone().catch(() => {});
  }, [status, userId, pushEnabled]);

  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: notificationsKey(userId ?? null) });
    });
    return () => sub.remove();
  }, [queryClient, userId]);

  // Wait until the session is known, so a signed-in screen does not open as a guest.
  useEffect(() => {
    if (!response || status === 'loading') return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const key = response.notification.request.identifier;
    if (opened.current === key) return;
    opened.current = key;
    const data = response.notification.request.content.data as { id?: unknown; href?: unknown } | undefined;
    if (status === 'signedIn' && typeof data?.id === 'number') {
      readOneRequest(data.id)
        .catch(() => {})
        .finally(() => void queryClient.invalidateQueries({ queryKey: notificationsKey(userId ?? null) }));
    }
    const href = safeHref(data?.href);
    if (href) router.push(href as Href);
  }, [response, status, router, queryClient]);

  useEffect(() => {
    if (pushSupported() && status !== 'loading') Notifications.setBadgeCountAsync(status === 'signedIn' ? unread : 0).catch(() => {});
  }, [unread, status]);

  return null;
}
