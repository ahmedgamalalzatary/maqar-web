import { ErrorText } from '@/components/error-text';
import { passwordOk, RESET_CODE_MINUTES, readResetCode } from '@maqar/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { m, useT } from '@/core/i18n';
import { authErrorMessage } from '../auth-errors';
import { useForgotPassword, useResetPassword } from '../hooks/use-auth';

/**
 * Phase 31 (2026-11-15): a forgotten password. The email gets a six-digit code; the code and a new
 * password sign the account in. Advisors get an email telling them to ask the admin instead.
 */
export function ForgotPasswordScreen() {
  const t = useT();
  const params = useLocalSearchParams<{ email?: string }>();
  const forgot = useForgotPassword();
  const reset = useResetPassword();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');

  const send = (to: string) =>
    forgot.mutate(to, {
      onSuccess: () => {
        if (sentTo) toast.show({ title: t(m.auth.aNewCodeIsOn), tone: 'sage' });
        setSentTo(to);
      },
    });
  const ask = () => {
    const to = email.trim();
    if (/^\S+@\S+\.\S+$/.test(to) && !forgot.isPending) send(to);
  };

  const typed = readResetCode(code);
  const weak = next !== '' && !passwordOk(next);
  const mismatch = again !== '' && again !== next;
  const ready = !!typed && passwordOk(next) && again === next;
  const save = () => {
    if (ready && sentTo && !reset.isPending) reset.mutate({ email: sentTo, code: typed, newPassword: next });
  };

  if (!sentTo) {
    return (
      <Screen title={t(m.auth.forgotPassword)}>
        <Txt color="ink2">{t(m.auth.typeYourAccountsEmailAnd)}</Txt>
        <TextField
          label={t(m.common.email)}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          onSubmitEditing={ask}
        />
        <ErrorText message={forgot.isError ? t(authErrorMessage(forgot.error)) : undefined} trigger={forgot.submittedAt} />
        <Button label={t(m.auth.sendMeTheCode)} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} loading={forgot.isPending} onPress={ask} />
      </Screen>
    );
  }

  const failure = reset.error;
  const failureText =
    failure instanceof ApiError && failure.status === 400
      ? t(m.auth.theCodeIsWrongOr)
      : failure
        ? t(authErrorMessage(failure))
        : null;

  return (
    <Screen title={t(m.common.newPassword2)}>
      <View style={styles.note}>
        <Txt color="ink2">
          {t(m.auth.codeSent(sentTo, RESET_CODE_MINUTES))}
        </Txt>
      </View>
      <TextField label={t(m.auth.code)} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={12} />
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
      <ErrorText message={failureText ?? undefined} trigger={reset.submittedAt} />
      <Button label={t(m.common.changePassword)} disabled={!ready} loading={reset.isPending} onPress={save} />
      <Button label={t(m.auth.sendTheCodeAgain)} variant="ghost" loading={forgot.isPending} onPress={() => send(sentTo)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingVertical: 4 },
});
