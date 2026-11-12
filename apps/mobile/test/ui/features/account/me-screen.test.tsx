import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';
import { MeScreen } from '@/features/account/screens/me-screen';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);
jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn().mockResolvedValue({ type: 'opened' }) }));

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

describe('MeScreen', () => {
  it('a guest is offered sign-in', async () => {
    await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });

  it('a client can reopen the preference questions; an agent has none', async () => {
    await useSession.getState().setSession(makeAuth({ role: 'client', prefs: null }));
    const view = await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'عدّل تفضيلاتك' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');

    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    await view.rerender(<MeScreen />);
    expect(screen.queryByRole('button', { name: 'عدّل تفضيلاتك' })).toBeNull();
  });

  it('guests and clients can open the calculator; an agent has no row for it', async () => {
    const { unmount } = await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'حاسبة التقسيط' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/calculator');
    await unmount();

    await useSession.getState().setSession(makeAuth({ role: 'agent' }));
    await renderWithProviders(<MeScreen />);
    expect(screen.queryByRole('button', { name: 'حاسبة التقسيط' })).toBeNull();
  });

  it('signing out ends the session on the server and returns to the client home', async () => {
    await useSession.getState().setSession(makeAuth({ name: 'Mona Adel' }));
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(204));
    await renderWithProviders(<MeScreen />);
    expect(screen.getByText('Mona Adel')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الخروج' }));

    expect(requestOf(fetchMock)).toMatchObject({ path: '/auth/sign-out', body: { refreshToken: 'refresh-token-1234567890' } });
    expect(useSession.getState().user).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('signing out first stops this phone getting the account’s pushes', async () => {
    await AsyncStorage.setItem('maqar.pushToken', 'ExponentPushToken[phone-1234567890]');
    await useSession.getState().setSession(makeAuth());
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(204));
    await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الخروج' }));
    const sent = fetchMock.mock.calls.map((_, k) => requestOf(fetchMock, k)).filter((r) => r.method !== undefined && r.method !== 'GET');
    expect(sent.slice(0, 2)).toEqual([
      { method: 'DELETE', path: '/me/push-tokens', body: { token: 'ExponentPushToken[phone-1234567890]' } },
      { method: 'POST', path: '/auth/sign-out', body: { refreshToken: 'refresh-token-1234567890' } },
    ]);
    expect(await AsyncStorage.getItem('maqar.pushToken')).toBeNull();
  });

  it('shows the phone notifications switch to a signed-in user only', async () => {
    mockFetch().mockResolvedValue(jsonResponse(200, { items: [], unread: 0 }));
    const view = await renderWithProviders(<MeScreen />);
    expect(screen.queryByLabelText('إشعارات الموبايل')).toBeNull();
    await useSession.getState().setSession(makeAuth());
    await view.rerender(<MeScreen />);
    expect(screen.getByLabelText('إشعارات الموبايل')).toBeOnTheScreen();
  });

  it('deleting the account asks for the password first', async () => {
    await useSession.getState().setSession(makeAuth());
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(204));
    await renderWithProviders(<MeScreen />);

    await fireEvent.press(screen.getByRole('button', { name: 'امسح حسابي' }));
    expect(fetchMock).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'Secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'امسح الحساب نهائيًا' }));

    expect(requestOf(fetchMock)).toMatchObject({ method: 'DELETE', path: '/me', body: { password: 'Secret123' } });
    expect(useSession.getState().user).toBeNull();
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  // Store rules (Apple 5.1.1, Google Play User Data): a privacy policy and a support contact,
  // reachable inside the app by everyone, guests included.
  it('everyone can open the privacy policy and terms, and write to support', async () => {
    const mail = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const origin = new URL(process.env.EXPO_PUBLIC_API_URL!).origin;
    await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'سياسة الخصوصية' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(`${origin}/privacy`);
    await fireEvent.press(screen.getByRole('button', { name: 'الشروط والأحكام' }));
    expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(`${origin}/terms`);
    // The support row left the list (2026-11-12); the address stays in the footer (Apple 1.2 and 1.5).
    expect(screen.queryByRole('button', { name: 'كلّم الدعم' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'maqarcompany@gmail.com' }));
    expect(mail).toHaveBeenCalledWith('mailto:maqarcompany@gmail.com');
  });

  it('opens the support page when the phone has no email app', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('No app handles mailto'));
    const origin = new URL(process.env.EXPO_PUBLIC_API_URL!).origin;
    await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('link', { name: 'maqarcompany@gmail.com' }));
    await waitFor(() => expect(WebBrowser.openBrowserAsync).toHaveBeenCalledWith(`${origin}/support`));
  });

  it('ends with the developer credit, whose number can be called', async () => {
    const call = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderWithProviders(<MeScreen />);
    expect(screen.getByText('Powered by Bit Tech')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('link', { name: '01501053600' }));
    expect(call).toHaveBeenCalledWith('tel:01501053600');
  });
});
