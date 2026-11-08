import { fireEvent, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';
import { useRequireAuth } from '@/features/auth/hooks/use-require-auth';
import { AuthPromptHost } from '@/features/auth/components/auth-prompt';
import { useSession } from '@/features/auth/store/session.store';
import { makeAuth } from '../../../utils/api';
import { renderWithProviders } from '../../../utils/render';
import { mockRouter } from '../../../utils/router';

jest.mock('expo-router', () => require('../../../utils/router').expoRouterMock);

// A screen action that needs an account, like "save" in a later phase.
function SaveButton({ onSave }: { onSave: () => void }) {
  const requireAuth = useRequireAuth();
  return (
    <Pressable accessibilityRole="button" onPress={() => requireAuth(onSave)}>
      <Text>save</Text>
    </Pressable>
  );
}

beforeEach(async () => {
  jest.clearAllMocks();
  await useSession.getState().clear();
});

describe('guest mode (contract §2)', () => {
  it('asks a guest to sign in at the moment an account is needed, instead of running the action', async () => {
    const onSave = jest.fn();
    await renderWithProviders(
      <>
        <SaveButton onSave={onSave} />
        <AuthPromptHost />
      </>,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'save' }));
    expect(onSave).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'تسجيل الدخول' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/sign-in');
  });

  it('runs the action straight away when signed in', async () => {
    await useSession.getState().setSession(makeAuth());
    const onSave = jest.fn();
    await renderWithProviders(<SaveButton onSave={onSave} />);
    await fireEvent.press(screen.getByRole('button', { name: 'save' }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });
});
