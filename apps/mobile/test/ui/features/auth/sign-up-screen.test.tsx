import { fireEvent, screen } from '@testing-library/react-native';
import { SignUpScreen } from '@/features/auth/screens/sign-up-screen';
import { setPendingAction, takePendingAction } from '@/features/auth/pending-action';
import { useSession } from '@/features/auth/store/session.store';
import { jsonResponse, makeAuth, mockFetch, requestOf } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

beforeEach(async () => {
  jest.clearAllMocks();
  setPendingAction(null);
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

  it('a guest mid-task keeps their pending action for onboarding to resume (UI-02)', async () => {
    mockFetch().mockResolvedValue(jsonResponse(201, makeAuth({ role: 'client', prefs: null })));
    const resume = jest.fn();
    setPendingAction(resume);
    await renderWithProviders(<SignUpScreen />);
    await fireEvent.changeText(screen.getByLabelText('الاسم'), 'Mona Adel');
    await fireEvent.changeText(screen.getByLabelText('الإيميل'), 'mona@test.maqar');
    await fireEvent.changeText(screen.getByLabelText('كلمة السر'), 'Secret123');
    await fireEvent.press(screen.getByRole('button', { name: 'إنشاء حساب' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/onboarding');
    // The action is still aside: onboarding's finish takes and runs it, not the sign-up.
    expect(resume).not.toHaveBeenCalled();
    expect(takePendingAction()).toBe(resume);
  });
});
