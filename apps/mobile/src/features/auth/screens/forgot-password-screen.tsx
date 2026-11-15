import { fmtNum, passwordOk, RESET_CODE_MINUTES, readResetCode } from '@maqar/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { toast } from '@/components/toast';
import { ApiError } from '@/core/api/api';
import { useT } from '@/core/i18n';
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
        if (sentTo) toast.show({ title: t('بعتنا كود جديد', 'A new code is on its way'), tone: 'sage' });
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
      <Screen title={t('نسيت كلمة السر', 'Forgot password')}>
        <Txt color="ink2">{t('اكتب إيميل حسابك، وهنبعتلك كود تعمل بيه كلمة سر جديدة.', 'Type your account’s email and we’ll send you a code to set a new password.')}</Txt>
        <TextField
          label={t('الإيميل', 'Email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          onSubmitEditing={ask}
        />
        {forgot.isError ? (
          <Txt color="danger" accessibilityLiveRegion="polite">
            {t(authErrorMessage(forgot.error))}
          </Txt>
        ) : null}
        <Button label={t('ابعتلي الكود', 'Send me the code')} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} loading={forgot.isPending} onPress={ask} />
      </Screen>
    );
  }

  const failure = reset.error;
  const failureText =
    failure instanceof ApiError && failure.status === 400
      ? t('الكود غلط أو وقته خلص. اطلب كود جديد لو محتاج.', 'The code is wrong or has expired. Ask for a new one if you need to.')
      : failure
        ? t(authErrorMessage(failure))
        : null;

  return (
    <Screen title={t('كلمة سر جديدة', 'New password')}>
      <View style={styles.note}>
        <Txt color="ink2">
          {t(
            `لو الإيميل ${sentTo} عليه حساب، هيوصله كود من ٦ أرقام شغال ${fmtNum(RESET_CODE_MINUTES, 'ar')} دقيقة. بص في الـ Spam لو مش لاقيه.`,
            `If ${sentTo} has an account, it gets a 6-digit code that works for ${RESET_CODE_MINUTES} minutes. Check spam if you can’t find it.`,
          )}
        </Txt>
      </View>
      <TextField label={t('الكود', 'Code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={12} />
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
      <Button label={t('غيّر كلمة السر', 'Change password')} disabled={!ready} loading={reset.isPending} onPress={save} />
      <Button label={t('ابعت الكود تاني', 'Send the code again')} variant="ghost" loading={forgot.isPending} onPress={() => send(sentTo)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: { paddingVertical: 4 },
});
