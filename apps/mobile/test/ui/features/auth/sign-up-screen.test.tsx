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
  it('creates an owner account in the current language and opens the owner portal', async () => {
    const fetchMock = mockFetch().mockResolvedValue(jsonResponse(201, makeAuth({ role: 'owner' })));
    await renderWithProviders(<SignUpScreen />);

    await fireEvent.press(screen.getByRole('radio', { name: /مالك عقار/ }));
    await fireEvent.changeText(screen.getByLabelText('الاسم'), 'Mona Adel');
    await fireEvent.changeText(screen.getByLabelText('الإيميل'), 'mona@test.maqar');
    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'Secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'إنشاء حساب' }));

    expect(requestOf(fetchMock)).toMatchObject({
      path: '/auth/sign-up',
      body: { name: 'Mona Adel', email: 'mona@test.maqar', password: 'Secret123', role: 'owner', lang: 'ar' },
    });
    expect(mockRouter.replace).toHaveBeenCalledWith('/owner');
  });
});
