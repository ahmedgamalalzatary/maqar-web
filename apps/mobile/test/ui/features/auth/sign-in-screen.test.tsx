import { fireEvent, screen } from '@testing-library/react-native';
import { useSession } from '@/features/auth/store/session.store';
import { SignInScreen } from '@/features/auth/screens/sign-in-screen';
import { jsonResponse, makeAuth, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

async function signIn(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('الإيميل'), email);
  await fireEvent.changeText(screen.getByLabelText('كلمة السر'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'دخول' }));
}

describe('SignInScreen', () => {
  it.each([
    ['agent', '/agent'],
    ['admin', '/admin'],
    ['client', '/'],
  ] as const)('a %s lands on their own home screen', async (role, home) => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(200, makeAuth({ role })));
    await renderWithProviders(<SignInScreen />);
    await signIn('omar@maqar.app', 'Secret123');

    expect(requestOf(fetchMock)).toMatchObject({
      method: 'POST',
      path: '/auth/sign-in',
      body: { email: 'omar@maqar.app', password: 'Secret123' },
    });
    expect(mockRouter.replace).toHaveBeenCalledWith(home);
    expect(useSession.getState().user?.role).toBe(role);
  });

  it('shows the server message when the password is wrong, and stays signed out', async () => {
    mockFetch().mockResolvedValue(jsonResponse(401, { statusCode: 401, message: 'Wrong email or password' }));
    await renderWithProviders(<SignInScreen />);
    await signIn('omar@maqar.app', 'nope');

    expect(await screen.findByText('الإيميل أو كلمة السر غلط')).toBeOnTheScreen();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(useSession.getState().user).toBeNull();
  });

  // The owner's choice (2026-11-13): guests can still browse (App Store 5.1.1), but the way in is a quiet link.
  it('offers browsing as a guest as a small link under the buttons', async () => {
    await renderWithProviders(<SignInScreen />);
    expect(screen.queryByRole('button', { name: 'كمّل كضيف' })).toBeNull();
    await fireEvent.press(screen.getByRole('link', { name: 'كمّل كضيف' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });
});
