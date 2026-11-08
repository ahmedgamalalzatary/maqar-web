import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useT } from '@/core/i18n';
import { authErrorMessage } from '../auth-errors';
import { useSignIn } from '../hooks/use-auth';

export function SignInScreen() {
  const t = useT();
  const router = useRouter();
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = email.trim() !== '' && password !== '';

  return (
    <Screen>
      <View style={styles.top}>
        <Logo width={110} />
        <Txt size={22} weight="semibold" align="center">
          {t('أهلًا بيك تاني', 'Welcome back')}
        </Txt>
      </View>
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
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => ready && signIn.mutate({ email: email.trim(), password })}
      />
      {signIn.isError ? (
        <Txt color="danger" accessibilityLiveRegion="polite">
          {t(authErrorMessage(signIn.error))}
        </Txt>
      ) : null}
      <Button
        label={t('دخول', 'Sign in')}
        disabled={!ready}
        loading={signIn.isPending}
        onPress={() => signIn.mutate({ email: email.trim(), password })}
      />
      <Button label={t('معندكش حساب؟ اعمل حساب', 'No account? Create one')} variant="ghost" onPress={() => router.replace('/sign-up')} />
      <Button label={t('كمّل كضيف', 'Continue as a guest')} variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
    </Screen>
  );
}

const styles = StyleSheet.create({ top: { alignItems: 'center', gap: 12, paddingVertical: 16 } });
