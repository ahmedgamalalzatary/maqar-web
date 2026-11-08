import type { AuthResponse, SignInBody, SignUpBody } from '@maqar/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSettings } from '@/core/settings/store';
import { signInRequest, signOutRequest, signUpRequest } from '../api/auth.api';
import { homeFor, useSession } from '../store/session.store';

/** After sign-in or sign-up: keep the session, apply the account's settings, open the role's home. */
function useOnSignedIn() {
  const router = useRouter();
  return async (auth: AuthResponse) => {
    await useSession.getState().setSession(auth);
    useSettings.setState({ lang: auth.user.lang, theme: auth.user.theme });
    router.replace(homeFor(auth.user.role));
  };
}

export function useSignIn() {
  const onSignedIn = useOnSignedIn();
  return useMutation({ mutationFn: (body: SignInBody) => signInRequest(body), onSuccess: onSignedIn });
}

export function useSignUp() {
  const onSignedIn = useOnSignedIn();
  return useMutation({ mutationFn: (body: SignUpBody) => signUpRequest(body), onSuccess: onSignedIn });
}

/** Ends the session on the server (best effort) and on the phone, then opens the client home. */
export function useSignOut() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return async () => {
    const token = useSession.getState().refreshToken;
    if (token) await signOutRequest(token).catch(() => {});
    await useSession.getState().clear();
    queryClient.clear();
    router.replace('/');
  };
}
