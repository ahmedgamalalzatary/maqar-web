import { fireEvent, screen } from '@testing-library/react-native';
import { ChangePasswordScreen } from '@/features/account/screens/change-password-screen';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().setSession(makeAuth({ role: 'client' }));
});

async function fill(current: string, next: string, again = next) {
  await fireEvent.changeText(screen.getByLabelText('كلمة السر الحالية'), current);
  await fireEvent.changeText(screen.getByLabelText('كلمة السر الجديدة'), next);
  await fireEvent.changeText(screen.getByLabelText('اكتب كلمة السر الجديدة تاني'), again);
}

// Phase 31 (2026-11-15): clients and admins change their own password.
describe('ChangePasswordScreen', () => {
  it('saves the new password and keeps this phone signed in with the new session', async () => {
    const fresh = { ...makeAuth({ role: 'client' }), accessToken: 'access-2', refreshToken: 'refresh-token-after-change-1' };
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(200, fresh));
    await renderWithProviders(<ChangePasswordScreen />);
    await fill('Secret123', 'Newpass456');
    await fireEvent.press(screen.getByRole('button', { name: 'غيّر كلمة السر' }));

    expect(requestOf(fetchMock)).toMatchObject({ method: 'PUT', path: '/me/password', body: { currentPassword: 'Secret123', newPassword: 'Newpass456' } });
    expect(useSession.getState().refreshToken).toBe('refresh-token-after-change-1');
    expect(useSession.getState().status).toBe('signedIn');
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('says so when the current password is wrong, and stays signed in', async () => {
    mockFetch().mockResolvedValue(jsonResponse(403, { statusCode: 403, message: 'Wrong current password' }));
    await renderWithProviders(<ChangePasswordScreen />);
    await fill('Wrong1234', 'Newpass456');
    await fireEvent.press(screen.getByRole('button', { name: 'غيّر كلمة السر' }));

    expect(await screen.findByText('كلمة السر الحالية غلط')).toBeOnTheScreen();
    expect(useSession.getState().status).toBe('signedIn');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('sends nothing while the new password is weak or the two do not match', async () => {
    const fetchMock = mockFetch();
    await renderWithProviders(<ChangePasswordScreen />);
    await fill('Secret123', 'short');
    expect(screen.getByText('٨ حروف على الأقل، فيها حرف ورقم')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'غيّر كلمة السر' })).toBeDisabled();

    await fill('Secret123', 'Newpass456', 'Newpass457');
    expect(screen.getByText('الكلمتين مش زي بعض')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'غيّر كلمة السر' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
