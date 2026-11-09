import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useLang, useT } from '@/core/i18n';
import { authErrorMessage } from '../auth-errors';
import { useSignUp } from '../hooks/use-auth';

/** Sign-up is for clients only: agents and admins are created by an admin, and there are no owner accounts. */
export function SignUpScreen() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const signUp = useSignUp();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = name.trim().length >= 2 && email.trim() !== '' && password !== '';

  return (
    <Screen title={t('حساب جديد', 'Create an account')}>
      <Txt color="ink2" style={styles.lead}>
        {t('احفظ الوحدات، تابع الأسعار، واحجز معاينات.', 'Save homes, follow prices and book viewings.')}
      </Txt>
      <TextField label={t('الاسم', 'Name')} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
      <TextField
        label={t('الإيميل', 'Email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('كلمة السر', 'Password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder={t('٨ حروف على الأقل، فيها حرف ورقم', '8+ characters, a letter and a digit')}
      />
      {signUp.isError ? (
        <Txt color="danger" accessibilityLiveRegion="polite">
          {t(authErrorMessage(signUp.error))}
        </Txt>
      ) : null}
      <Button
        label={t('إنشاء حساب', 'Create account')}
        disabled={!ready}
        loading={signUp.isPending}
        onPress={() => signUp.mutate({ name: name.trim(), email: email.trim(), password, lang })}
      />
      <Button label={t('عندك حساب؟ ادخل', 'Have an account? Sign in')} variant="ghost" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: -8 },
});
