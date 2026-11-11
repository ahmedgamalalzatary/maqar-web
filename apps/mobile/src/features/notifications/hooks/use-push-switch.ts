import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toast } from '@/components/toast';
import { useT } from '@/core/i18n';
import { updateMeRequest } from '@/features/account/api/me.api';
import { useSession } from '@/features/auth/store/session.store';
import { sendTestRequest } from '../api/notifications.api';
import { askPushPermission, type PushPermission, pushPermission, registerThisPhone } from '../push';
import { notificationsKey } from './use-notifications';

/**
 * The "Phone notifications" switch in Me (contract §8.13). It is on when the account wants pushes
 * and the phone allows them. On asks the phone the first time; off keeps the in-app inbox.
 */
export function usePushSwitch() {
  const t = useT();
  const queryClient = useQueryClient();
  const user = useSession((s) => s.user);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [busy, setBusy] = useState(false);

  // Checked again on coming back to the app, as the user may have changed it in the phone's settings.
  useEffect(() => {
    let live = true;
    const check = () =>
      pushPermission()
        .then((p) => live && setPermission(p))
        .catch(() => {});
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  const setPushEnabled = async (pushEnabled: boolean) => {
    const me = useSession.getState().user;
    if (me) useSession.getState().setUser({ ...me, pushEnabled });
    try {
      await updateMeRequest({ pushEnabled });
      return true;
    } catch {
      if (me) useSession.getState().setUser({ ...me, pushEnabled: !pushEnabled });
      return false;
    }
  };

  const failed = () =>
    toast.show({
      title: t('معرفناش نشغّل الإشعارات', 'Couldn’t turn notifications on'),
      body: t('اتأكد إنك متصل بالإنترنت وجرّب تاني.', 'Check your connection and try again.'),
      tone: 'danger',
    });

  const turnOff = async () => {
    if (!(await setPushEnabled(false))) {
      toast.show({ title: t('معرفناش نقفلها', 'Couldn’t turn them off'), body: t('جرّب تاني.', 'Please try again.'), tone: 'danger' });
      return;
    }
    toast.show({
      title: t('اتقفلت إشعارات الموبايل', 'Phone notifications off'),
      body: t('هتفضل توصلك التنبيهات جوه التطبيق.', 'You’ll still see alerts inside the app.'),
      tone: 'sage',
    });
  };

  const turnOn = async () => {
    const p = await askPushPermission();
    setPermission(p);
    if (p === 'denied') {
      toast.show({
        title: t('الموبايل مانع الإشعارات', 'Notifications are blocked'),
        body: t('اسمح بيها لمقر من إعدادات الموبايل وجرّب تاني.', 'Allow them for Maqar in your phone’s settings, then try again.'),
        tone: 'danger',
      });
      return;
    }
    if (p !== 'granted') return;
    const registered = await registerThisPhone().catch(() => false);
    if (!registered || !(await setPushEnabled(true))) return failed();
    await sendTestRequest().catch(() => {});
    void queryClient.invalidateQueries({ queryKey: notificationsKey(useSession.getState().user?.id ?? null) });
    toast.show({
      title: t('الإشعارات شغالة', 'Notifications are on'),
      body: t('هيوصلك تذكير المعاينات ونزول الأسعار.', 'You’ll get viewing reminders and price drops.'),
      tone: 'sage',
    });
  };

  const turn = async (on: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      await (on ? turnOn() : turnOff());
    } finally {
      setBusy(false);
    }
  };

  return { on: !!user?.pushEnabled && permission === 'granted', permission, busy, turn };
}
