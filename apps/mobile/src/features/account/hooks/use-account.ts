import type { Lang, ThemePref, UpdateMeBody } from '@maqar/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useSettings } from '@/core/settings/store';
import { useSession } from '@/features/auth/store/session.store';
import { deleteMeRequest, updateMeRequest } from '../api/me.api';

export function useUpdateMe() {
  return useMutation({
    mutationFn: (body: UpdateMeBody) => updateMeRequest(body),
    onSuccess: (me) => useSession.getState().setUser(me),
  });
}

/** Language and theme change on the phone at once, and are saved to the account when signed in. */
export function usePreferences() {
  const { setLang, setTheme } = useSettings();
  const signedIn = useSession((s) => s.status === 'signedIn');
  const save = (body: UpdateMeBody) => {
    if (signedIn) updateMeRequest(body).then((me) => useSession.getState().setUser(me), () => {});
  };
  return {
    setLang: (lang: Lang) => {
      setLang(lang);
      save({ lang });
    },
    setTheme: (theme: ThemePref) => {
      setTheme(theme);
      save({ theme });
    },
  };
}

export function useDeleteAccount() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => deleteMeRequest(password),
    onSuccess: async () => {
      await useSession.getState().clear();
      queryClient.clear();
      router.replace('/');
    },
  });
}
