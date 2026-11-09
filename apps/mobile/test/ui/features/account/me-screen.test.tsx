import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, screen } from '@testing-library/react-native';
import { MeScreen } from '@/features/account/screens/me-screen';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

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
});
