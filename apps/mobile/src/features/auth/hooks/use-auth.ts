import type { AuthResponse, SignInBody, SignUpBody } from '@maqar/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSettings } from '@/core/settings/store';
import { forgetThisPhone } from '@/features/notifications/push';
import { signInRequest, signOutRequest, signUpRequest } from '../api/auth.api';
import { takePendingAction } from '../pending-action';
import { homeFor, useSession } from '../store/session.store';

/**
 * After sign-in or sign-up: keep the session and apply the account's settings. A new client goes
 * through the preference questions first (contract §8.1). A guest who was interrupted mid-task
 * (book, save, follow, chat) resumes exactly that instead of being dropped on the role's home.
 */
function useOnSignedIn(isNew = false) {
  const router = useRouter();
  return async (auth: AuthResponse) => {
    await useSession.getState().setSession(auth);
    useSettings.setState({ lang: auth.user.lang, theme: auth.user.theme });
    if (isNew && auth.user.role === 'client') {
      // Onboarding's finish takes and runs the pending action; taking it here would lose it.
      router.replace('/onboarding');
      return;
    }
    const resume = takePendingAction();
    if (resume) {
      // The resume runs where the guest left off, so the sign-in screen gets out of the way first.
      if (router.canGoBack()) router.back();
      resume();
    } else router.replace(homeFor(auth.user.role));
  };
}

export function useSignIn() {
  const onSignedIn = useOnSignedIn();
  return useMutation({ mutationFn: (body: SignInBody) => signInRequest(body), onSuccess: onSignedIn });
}

export function useSignUp() {
  const onSignedIn = useOnSignedIn(true);
  return useMutation({ mutationFn: (body: SignUpBody) => signUpRequest(body), onSuccess: onSignedIn });
}

/**
 * Ends the session on the server (best effort) and on the phone, then opens the client home. The
 * phone stops getting the account's pushes first, while the session can still say so.
 */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    await forgetThisPhone();
    const token = useSession.getState().refreshToken;
    if (token) await signOutRequest(token).catch(() => {});
    await useSession.getState().clear();
    queryClient.clear();
    router.replace('/');
  };
}
