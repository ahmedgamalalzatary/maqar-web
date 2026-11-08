import { useCallback } from 'react';
import { useAuthPrompt } from '../components/auth-prompt';
import { useSession } from '../store/session.store';

/**
 * Guests are asked to sign in at the moment they need an account, not before (contract §2).
 * `requireAuth(save)` runs `save` when signed in, otherwise opens the sign-in prompt.
 */
export function useRequireAuth() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useCallback(
    (action: () => void) => {
      if (signedIn) action();
      else useAuthPrompt.setState({ open: true });
    },
    [signedIn],
  );
}
