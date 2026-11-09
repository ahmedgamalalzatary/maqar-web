import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import { deletePushTokenRequest, savePushTokenRequest } from './api/notifications.api';

/**
 * Whether this phone may show Maqar's notifications. `denied` means the phone blocks them and
 * will not ask again, so only its settings can allow them. `unsupported` is the web and simulators.
 */
export type PushPermission = 'granted' | 'denied' | 'undetermined' | 'unsupported';

const TOKEN_KEY = 'maqar.pushToken';

export const pushSupported = () => Platform.OS !== 'web' && Device.isDevice;

function toPermission(p: Notifications.NotificationPermissionsStatus): PushPermission {
  if (p.granted || p.ios?.status === IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return p.canAskAgain ? 'undetermined' : 'denied';
}

export async function pushPermission(): Promise<PushPermission> {
  if (!pushSupported()) return 'unsupported';
  return toPermission(await Notifications.getPermissionsAsync());
}

/** Android 13+ only shows the permission prompt once a channel exists. */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Maqar',
    importance: AndroidImportance.HIGH,
    lightColor: '#b38959',
  });
}

/** Asks the phone, when it still can. */
export async function askPushPermission(): Promise<PushPermission> {
  if (!pushSupported()) return 'unsupported';
  await ensureChannel();
  const now = await Notifications.getPermissionsAsync();
  if (toPermission(now) !== 'undetermined') return toPermission(now);
  return toPermission(await Notifications.requestPermissionsAsync());
}

/**
 * Sends this phone's push token to the account, so the server can reach it. Needs the permission
 * already. False when the phone has no token to give (no Expo project id, or offline).
 */
export async function registerThisPhone(): Promise<boolean> {
  if ((await pushPermission()) !== 'granted') return false;
  await ensureChannel();
  let token: string;
  try {
    token = (await Notifications.getExpoPushTokenAsync()).data;
  } catch {
    return false;
  }
  await savePushTokenRequest({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return true;
}

/** On sign-out: this phone stops getting the account's pushes. Best effort. */
export async function forgetThisPhone(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  await deletePushTokenRequest(token).catch(() => {});
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => {});
}

/** A screen from a notification is opened only when it is one of the app's own paths. */
export function safeHref(href: unknown): string | null {
  return typeof href === 'string' && /^\/(?!\/)[\w\-/?=&%.[\]]*$/.test(href) ? href : null;
}
