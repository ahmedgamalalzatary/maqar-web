import { passwordOk } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { errorText } from '@/core/api/error-text';
import { useT } from '@/core/i18n';
import { useChangePassword } from '../hooks/use-account';

/**
 * Phase 31 (2026-11-15): a client or an admin sets a new password. This phone stays signed in
 * with the new session; every other device is signed out.
 */
export function ChangePasswordScreen() {
  const t = useT();
  const router = useRouter();
  const change = useChangePassword();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const weak = next !== '' && !passwordOk(next);
  const mismatch = again !== '' && again !== next;
  const ready = current !== '' && passwordOk(next) && again === next;

  const save = () => {
    if (!ready || change.isPending) return;
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => {
          toast.show({ title: t('كلمة السر اتغيرت', 'Password changed'), body: t('خرجنا من الأجهزة التانية.', 'Other devices were signed out.'), tone: 'sage' });
          router.back();
        },
      },
    );
  };

  const failure = change.error;
  const failureText =
    failure instanceof ApiError && failure.status === 403
      ? t('كلمة السر الحالية غلط', 'The current password is wrong')
      : failure instanceof ApiError && failure.status === 400
        ? t('كلمة السر الجديدة لازم تكون مختلفة عن الحالية', 'The new password must be different from the current one')
        : failure
          ? errorText(failure, t)
          : null;

  return (
    <Screen title={t('غيّر كلمة السر', 'Change password')}>
      <TextField label={t('كلمة السر الحالية', 'Current password')} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" />
      <TextField
        label={t('كلمة السر الجديدة', 'New password')}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={weak ? t('٨ حروف على الأقل، فيها حرف ورقم', 'At least 8 characters, with a letter and a digit') : undefined}
      />
      <TextField
        label={t('اكتب كلمة السر الجديدة تاني', 'Type the new password again')}
        value={again}
        onChangeText={setAgain}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={save}
        error={mismatch ? t('الكلمتين مش زي بعض', 'The two don’t match') : undefined}
      />
      {failureText ? (
        <Txt color="danger" accessibilityLiveRegion="polite">
          {failureText}
        </Txt>
      ) : null}
      <Button label={t('غيّر كلمة السر', 'Change password')} disabled={!ready} loading={change.isPending} onPress={save} />
      <Button label={t('إلغاء', 'Cancel')} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
