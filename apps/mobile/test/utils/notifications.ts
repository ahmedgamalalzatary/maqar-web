// A stand-in for expo-notifications (jest.setup.ts installs it for every test file).
// Tests set `pushState` to play the phone: what it allows now, and what it answers when asked.

type Status = 'granted' | 'denied' | 'undetermined';
type Response = {
  actionIdentifier: string;
  notification: { request: { identifier: string; content: { data: Record<string, unknown> } } };
};

export const PHONE_TOKEN = 'ExponentPushToken[test-phone-token-123]';
export const DEFAULT_ACTION = 'expo.modules.notifications.actions.DEFAULT';

export const pushState = {
  status: 'undetermined' as Status,
  canAskAgain: true,
  /** What the phone's prompt answers. */
  answer: 'granted' as Status,
  /** The tap that opened the app, as `useLastNotificationResponse` gives it. */
  lastResponse: null as Response | null,
};

export function resetPushState() {
  Object.assign(pushState, { status: 'undetermined', canAskAgain: true, answer: 'granted', lastResponse: null });
}

/** A tap on a push, with the data the API puts in it. */
export const tapOn = (data: Record<string, unknown>, identifier = `push-${Math.random()}`): Response => ({
  actionIdentifier: DEFAULT_ACTION,
  notification: { request: { identifier, content: { data } } },
});

const permission = () => ({
  granted: pushState.status === 'granted',
  status: pushState.status,
  canAskAgain: pushState.canAskAgain,
  expires: 'never',
});

export const notificationsMock = {
  getPermissionsAsync: jest.fn(async () => permission()),
  requestPermissionsAsync: jest.fn(async () => {
    pushState.status = pushState.answer;
    if (pushState.answer === 'denied') pushState.canAskAgain = false;
    return permission();
  }),
  getExpoPushTokenAsync: jest.fn(async () => ({ type: 'expo', data: PHONE_TOKEN })),
  setNotificationChannelAsync: jest.fn(async () => null),
  setNotificationHandler: jest.fn(),
  addNotificationReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  useLastNotificationResponse: () => pushState.lastResponse,
  setBadgeCountAsync: jest.fn(async () => true),
  DEFAULT_ACTION_IDENTIFIER: DEFAULT_ACTION,
  AndroidImportance: { HIGH: 5 },
  IosAuthorizationStatus: { PROVISIONAL: 3 },
};
