import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { useSession } from '@/features/auth/store/session.store';
import { NotificationBell } from '@/features/notifications/components/notification-bell';
import { PushBridge } from '@/features/notifications/components/push-bridge';
import { jsonResponse, makeAuth, mockFetch } from '../../../utils/api';
import { pushState, resetPushState, tapOn } from '../../../utils/notifications';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

/** Answers the inbox with `unread` unread; returns the other calls as "METHOD /path". */
function serve(unread = 0) {
  const fetchMock = mockFetch().mockImplementation(async (url: string) => {
    const path = url.replace(/^.*\/v1/, '');
    if (path === '/notifications') return jsonResponse(200, { items: [], unread });
    return jsonResponse(204);
  });
  return () =>
    fetchMock.mock.calls
      .map(([url, init]: [string, RequestInit]) => `${init.method ?? 'GET'} ${url.replace(/^.*\/v1/, '')}`)
      .filter((c) => c !== 'GET /notifications');
}

beforeEach(async () => {
  jest.clearAllMocks();
  resetPushState();
  await useSession.getState().clear();
});

describe('Phone pushes', () => {
  it('opens the screen of a tapped push and marks it read', async () => {
    await useSession.getState().setSession(makeAuth());
    pushState.lastResponse = tapOn({ id: 7, href: '/property/4' });
    const calls = serve();
    await renderWithProviders(<PushBridge />);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/property/4'));
    await waitFor(() => expect(calls()).toContain('POST /notifications/7/read'));
  });

  it('opens a tapped push only once', async () => {
    await useSession.getState().setSession(makeAuth());
    pushState.lastResponse = tapOn({ id: 7, href: '/property/4' }, 'same');
    serve();
    const view = await renderWithProviders(<PushBridge />);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledTimes(1));
    await view.rerender(<PushBridge />);
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('waits for the saved session before opening a tapped push', async () => {
    useSession.setState({ status: 'loading' });
    pushState.lastResponse = tapOn({ id: 7, href: '/agent/leads' });
    serve();
    const view = await renderWithProviders(<PushBridge />);
    expect(mockRouter.push).not.toHaveBeenCalled();
    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    await view.rerender(<PushBridge />);
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/agent/leads'));
  });

  it('never opens a link that is not one of the app’s own screens', async () => {
    await useSession.getState().setSession(makeAuth());
    pushState.lastResponse = tapOn({ id: 7, href: 'https://evil.example/x' });
    const calls = serve();
    await renderWithProviders(<PushBridge />);
    await waitFor(() => expect(calls()).toContain('POST /notifications/7/read'));
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('connects this phone on launch when notifications are allowed and wanted', async () => {
    pushState.status = 'granted';
    await useSession.getState().setSession(makeAuth({ pushEnabled: true }));
    const calls = serve();
    await renderWithProviders(<PushBridge />);
    await waitFor(() => expect(calls()).toEqual(['POST /me/push-tokens']));
    expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalled();
  });

  it('does not connect the phone or ask when they are not allowed, or not wanted', async () => {
    await useSession.getState().setSession(makeAuth({ pushEnabled: true }));
    const calls = serve();
    const view = await renderWithProviders(<PushBridge />);
    await view.unmount();
    pushState.status = 'granted';
    await useSession.getState().setSession(makeAuth({ pushEnabled: false }));
    await renderWithProviders(<PushBridge />);
    await waitFor(() => expect(Notifications.setBadgeCountAsync).toHaveBeenCalled());
    expect(calls()).toEqual([]);
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it('keeps the app icon’s badge at the unread count', async () => {
    await useSession.getState().setSession(makeAuth());
    serve(3);
    await renderWithProviders(<PushBridge />);
    await waitFor(() => expect(Notifications.setBadgeCountAsync).toHaveBeenLastCalledWith(3));
  });
});

describe('The bell on Home', () => {
  it('shows a dot and the count while something is unread, and opens the inbox', async () => {
    await useSession.getState().setSession(makeAuth());
    serve(2);
    await renderWithProviders(<NotificationBell />);
    const bell = await screen.findByRole('button', { name: 'التنبيهات، 2 جديد' });
    expect(screen.getByTestId('bell-dot')).toBeOnTheScreen();
    await fireEvent.press(bell);
    expect(mockRouter.push).toHaveBeenCalledWith('/notifications');
  });

  it('has no dot with nothing unread', async () => {
    await useSession.getState().setSession(makeAuth());
    serve(0);
    await renderWithProviders(<NotificationBell />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'التنبيهات' })).toBeOnTheScreen());
    expect(screen.queryByTestId('bell-dot')).toBeNull();
  });
});
