import { fireEvent, screen } from '@testing-library/react-native';
import { SignUpScreen } from '@/features/auth/screens/sign-up-screen';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

describe('SignUpScreen', () => {
  it('creates a client account in the current language, with no role to pick', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(201, makeAuth({ role: 'client' })));
    await renderWithProviders(<SignUpScreen />);

    // There are no owner accounts (2026-11-09): sign-up offers no choice of role.
    expect(screen.queryByRole('radio')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('الاسم'), 'Mona Adel');
    await fireEvent.changeText(screen.getByLabelText('الإيميل'), 'mona@test.maqar');
    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'Secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'إنشاء حساب' }));

    expect(requestOf(fetchMock)).toMatchObject({
      path: '/auth/sign-up',
      body: { name: 'Mona Adel', email: 'mona@test.maqar', password: 'Secret123', lang: 'ar' },
    });
    expect(requestOf(fetchMock).body).not.toHaveProperty('role');
  });

  it('a new client goes on to the preference questions', async () => {
    mockFetch().mockResolvedValue(jsonResponse(201, makeAuth({ role: 'client', prefs: null })));
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('الاسم'), 'Mona Adel');
    await fireEvent.changeText(screen.getByLabelText('الإيميل'), 'mona@test.maqar');
    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'Secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'إنشاء حساب' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');
  });
});
