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

  it('a client can reopen the preference questions; an owner has none', async () => {
    await useSession.getState().setSession(makeAuth({ role: 'client', prefs: null }));
    const view = await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'عدّل تفضيلاتك' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/onboarding');

    await useSession.getState().setSession(makeAuth({ role: 'owner' }));
    await view.rerender(<MeScreen />);
    expect(screen.queryByRole('button', { name: 'عدّل تفضيلاتك' })).toBeNull();
  });

  it('guests and clients can open the calculator; an owner has no row for it', async () => {
    const { unmount } = await renderWithProviders(<MeScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'حاسبة التقسيط' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/calculator');
    await unmount();

    await useSession.getState().setSession(makeAuth({ role: 'owner' }));
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
