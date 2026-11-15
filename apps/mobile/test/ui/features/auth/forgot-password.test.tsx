import { fireEvent, screen } from '@testing-library/react-native';
import { ForgotPasswordScreen } from '@/features/auth/screens/forgot-password-screen';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

async function askForCode(email: string) {
  await fireEvent.changeText(screen.getByLabelText('الإيميل'), email);
  await fireEvent.press(screen.getByRole('button', { name: 'ابعتلي الكود' }));
}

async function setNew(code: string, password = 'Fresh4567', again = password) {
  await fireEvent.changeText(screen.getByLabelText('الكود'), code);
  await fireEvent.changeText(screen.getByLabelText('كلمة السر الجديدة'), password);
  await fireEvent.changeText(screen.getByLabelText('اكتب كلمة السر الجديدة تاني'), again);
  await fireEvent.press(screen.getByRole('button', { name: 'غيّر كلمة السر' }));
}

// Phase 31 (2026-11-15): a forgotten password is set again with a code sent by email.
describe('ForgotPasswordScreen', () => {
  it('sends the code, then sets the new password with it and signs in', async () => {
    const fetchMock = mockFetch()
      .mockResolvedValueOnce(jsonResponse(204))
      .mockResolvedValueOnce(jsonResponse(200, makeAuth({ role: 'client' })));
    await renderWithProviders(<ForgotPasswordScreen />);
    await askForCode(' mona@example.com ');
    expect(requestOf(fetchMock)).toMatchObject({ method: 'POST', path: '/auth/forgot-password', body: { email: 'mona@example.com' } });
    expect(await screen.findByText(/mona@example.com/)).toBeOnTheScreen();

    // Arabic digits are read as the code.
    await setNew('١٢٣ ٤٥٦');
    expect(requestOf(fetchMock, 1)).toMatchObject({
      method: 'POST',
      path: '/auth/reset-password',
      body: { email: 'mona@example.com', code: '123456', newPassword: 'Fresh4567' },
    });
    expect(useSession.getState().status).toBe('signedIn');
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('says so when the code is wrong or old, and stays signed out', async () => {
    mockFetch()
      .mockResolvedValueOnce(jsonResponse(204))
      .mockResolvedValueOnce(jsonResponse(400, { statusCode: 400, message: 'Wrong or expired code' }));
    await renderWithProviders(<ForgotPasswordScreen />);
    await askForCode('mona@example.com');
    await screen.findByLabelText('الكود');
    await setNew('123456');
    expect(await screen.findByText('الكود غلط أو وقته خلص. اطلب كود جديد لو محتاج.')).toBeOnTheScreen();
    expect(useSession.getState().status).toBe('guest');
  });

  it('can send the code again', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(204));
    await renderWithProviders(<ForgotPasswordScreen />);
    await askForCode('mona@example.com');
    await fireEvent.press(await screen.findByRole('button', { name: 'ابعت الكود تاني' }));
    expect(requestOf(fetchMock, 1)).toMatchObject({ path: '/auth/forgot-password', body: { email: 'mona@example.com' } });
  });
});
