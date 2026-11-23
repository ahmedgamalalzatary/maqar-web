import { ErrorText } from '@/components/error-text';
import { passwordOk } from '@mqr/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { errorText } from '@/core/api/error-text';
import { m, useT } from '@/core/i18n';
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
          toast.show({ title: t(m.common.passwordChanged), body: t(m.account.otherDevicesWereSignedOut), tone: 'sage' });
          router.back();
        },
      },
    );
  };

  const failure = change.error;
  const failureText =
    failure instanceof ApiError && failure.status === 403
      ? t(m.account.theCurrentPasswordIsWrong)
      : failure instanceof ApiError && failure.status === 400
        ? t(m.account.theNewPasswordMustBe)
        : failure
          ? errorText(failure, t)
          : null;

  return (
    <Screen title={t(m.common.changePassword)}>
      <TextField label={t(m.account.currentPassword)} value={current} onChangeText={setCurrent} secureTextEntry autoComplete="current-password" textContentType="password" />
      <TextField
        label={t(m.common.newPassword)}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        error={weak ? t(m.common.atLeast8CharactersWith) : undefined}
      />
      <TextField
        label={t(m.common.typeTheNewPasswordAgain)}
        value={again}
        onChangeText={setAgain}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={save}
        error={mismatch ? t(m.common.theTwoDontMatch) : undefined}
      />
      <ErrorText message={failureText ?? undefined} trigger={change.submittedAt} />
      <Button label={t(m.common.changePassword)} disabled={!ready} loading={change.isPending} onPress={save} />
      <Button label={t(m.common.cancel)} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
