import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { ToastHost, toast } from '@/components/toast';
import { useSession } from '@/features/auth/store/session.store';
import { PushRow } from '@/features/notifications/components/push-row';
import { jsonResponse, makeAuth, makeMe, mockFetch } from '../../../utils/api';
import { PHONE_TOKEN, pushState, resetPushState } from '../../../utils/notifications';
import { renderWithProviders } from '../../../utils/render';

const SWITCH = 'إشعارات الموبايل';

/** Answers every request; returns them as "METHOD /path body". */
function serve(fail?: string) {
  const fetchMock = mockFetch().mockImplementation(async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/v1/, '');
    if (fail && path === fail) return jsonResponse(500, { message: 'down' });
    if (path === '/me') return jsonResponse(200, makeMe(JSON.parse(init.body as string)));
    if (path === '/notifications/test') return jsonResponse(201, {});
    if (path === '/notifications') return jsonResponse(200, { items: [], unread: 0 });
    return jsonResponse(204);
  });
  return () =>
    fetchMock.mock.calls
      .map(([url, init]: [string, RequestInit]) => `${init.method ?? 'GET'} ${url.replace(/^.*\/v1/, '')}${init.body ? ` ${init.body}` : ''}`)
      .filter((c) => !c.startsWith('GET /notifications'));
}

const toggle = () => screen.getByLabelText(SWITCH);
const Row = () => (
  <>
    <PushRow />
    <ToastHost />
  </>
);

beforeEach(async () => {
  jest.clearAllMocks();
  resetPushState();
  toast.clear();
  await AsyncStorage.clear();
  await useSession.getState().setSession(makeAuth({ pushEnabled: true }));
});

describe('The phone notifications switch', () => {
  it('is off until the phone allows notifications, even when the account wants them', async () => {
    serve();
    await renderWithProviders(<Row />);
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    expect(toggle()).toHaveProp('value', false);
    expect(screen.getByText('مقفولة')).toBeOnTheScreen();
  });

  it('turning it on asks the phone, connects this phone, saves the choice and sends a test notification', async () => {
    const calls = serve();
    await renderWithProviders(<Row />);
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    await fireEvent(toggle(), 'valueChange', true);

    await waitFor(() => expect(toggle()).toHaveProp('value', true));
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(calls()).toEqual([
      `POST /me/push-tokens ${JSON.stringify({ token: PHONE_TOKEN, platform: 'ios' })}`,
      'PATCH /me {"pushEnabled":true}',
      'POST /notifications/test',
    ]);
    expect(await AsyncStorage.getItem('maqar.pushToken')).toBe(PHONE_TOKEN);
    expect(screen.getByText('مفعّلة')).toBeOnTheScreen();
    expect(await screen.findByText('الإشعارات شغالة')).toBeOnTheScreen();
  });

  it('turning it off keeps the permission but stops pushes to the account', async () => {
    pushState.status = 'granted';
    const calls = serve();
    await renderWithProviders(<Row />);
    await waitFor(() => expect(toggle()).toHaveProp('value', true));
    await fireEvent(toggle(), 'valueChange', false);

    await waitFor(() => expect(toggle()).toHaveProp('value', false));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(calls()).toEqual(['PATCH /me {"pushEnabled":false}']);
    expect(useSession.getState().user?.pushEnabled).toBe(false);
    expect(await screen.findByText('هتفضل توصلك التنبيهات جوه التطبيق.')).toBeOnTheScreen();
  });

  it('turns back on without asking the phone again', async () => {
    pushState.status = 'granted';
    await useSession.getState().setSession(makeAuth({ pushEnabled: false }));
    const calls = serve();
    await renderWithProviders(<Row />);
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    expect(toggle()).toHaveProp('value', false);
    await fireEvent(toggle(), 'valueChange', true);
    await waitFor(() => expect(toggle()).toHaveProp('value', true));
    expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(calls()).toContain('PATCH /me {"pushEnabled":true}');
  });

  it('says so when the phone blocks notifications, and opens the phone’s settings', async () => {
    pushState.answer = 'denied';
    const calls = serve();
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    await renderWithProviders(<Row />);
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    await fireEvent(toggle(), 'valueChange', true);

    expect(await screen.findByText('مقفولة من إعدادات الموبايل')).toBeOnTheScreen();
    expect(toggle()).toHaveProp('value', false);
    expect(calls()).toEqual([]);
    expect(await screen.findByText('الموبايل مانع الإشعارات')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: 'افتح الإعدادات' }));
    expect(openSettings).toHaveBeenCalled();
  });

  it('stays off and says so when the account cannot be updated', async () => {
    pushState.status = 'granted';
    await useSession.getState().setSession(makeAuth({ pushEnabled: false }));
    serve('/me');
    await renderWithProviders(<Row />);
    await waitFor(() => expect(toggle()).not.toBeDisabled());
    await fireEvent(toggle(), 'valueChange', true);
    expect(await screen.findByText('معرفناش نشغّل الإشعارات')).toBeOnTheScreen();
    expect(toggle()).toHaveProp('value', false);
    expect(useSession.getState().user?.pushEnabled).toBe(false);
  });
});
