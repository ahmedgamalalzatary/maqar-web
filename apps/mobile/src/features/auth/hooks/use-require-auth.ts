import { useCallback } from 'react';
import { useAuthPrompt } from '../components/auth-prompt';
import { setPendingAction } from '../pending-action';
import { useSession } from '../store/session.store';

/**
 * Guests are asked to sign in at the moment they need an account, not before (contract §2).
 * `requireAuth(save)` runs `save` when signed in; otherwise the save is kept aside and the sign-in
 * prompt opens, so the guest resumes exactly what they were doing once they have an account.
 */
export function useRequireAuth() {
  const signedIn = useSession((s) => s.status === 'signedIn');
  return useCallback(
    (action: () => void) => {
      if (signedIn) action();
      else {
        setPendingAction(action);
        useAuthPrompt.setState({ open: true });
      }
    },
    [signedIn],
  );
}
