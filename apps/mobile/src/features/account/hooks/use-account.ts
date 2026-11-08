import type { Lang, ThemePref, UpdateMeBody } from '@maqar/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { toast } from '@/components/toast';
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
    const user = useSession.getState().user;
    if (!signedIn || !user) return;
    // Apply only this change, so a slow earlier response cannot undo a newer one.
    useSession.getState().setUser({ ...user, ...body });
    updateMeRequest(body).catch(() => {
      const ar = useSettings.getState().lang === 'ar';
      toast.show({
        title: ar ? 'محفوظ على الموبايل بس' : 'Saved on this phone only',
        body: ar ? 'معرفناش نحفظه في حسابك.' : "Couldn't save it to your account.",
        tone: 'danger',
      });
    });
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
