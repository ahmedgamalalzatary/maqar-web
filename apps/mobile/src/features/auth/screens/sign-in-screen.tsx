import { ErrorText } from '@/components/error-text';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { m, useT } from '@/core/i18n';
import { authErrorMessage } from '../auth-errors';
import { useSignIn } from '../hooks/use-auth';

export function SignInScreen() {
  const t = useT();
  const router = useRouter();
  const signIn = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = email.trim() !== '' && password !== '';
  const submit = () => {
    if (ready && !signIn.isPending) signIn.mutate({ email: email.trim(), password });
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Logo width={110} />
        <Txt size={22} weight="semibold" align="center">
          {t(m.auth.welcomeBack)}
        </Txt>
      </View>
      <TextField
        label={t(m.common.email)}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t(m.common.password)}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      {/* Phase 31: a code by email sets a new password. */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t(m.common.forgotYourPassword)}
        onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
        hitSlop={12}
        style={styles.forgot}
      >
        <Txt size={13} color="accentInk">
          {t(m.common.forgotYourPassword)}
        </Txt>
      </Pressable>
      <ErrorText message={signIn.isError ? t(authErrorMessage(signIn.error)) : undefined} trigger={signIn.submittedAt} />
      <Button
        label={t(m.auth.signIn)}
        disabled={!ready}
        loading={signIn.isPending}
        onPress={submit}
      />
      <Button label={t(m.auth.noAccountCreateOne)} variant="ghost" onPress={() => router.replace('/sign-up')} />
      {/* Browsing needs no account (App Store 5.1.1), so this stays; the owner wants it quiet (2026-11-13). */}
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={t(m.common.continueAsAGuest)}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        hitSlop={12}
        style={styles.guest}
      >
        <Txt size={12.5} color="ink3" style={styles.guestText}>
          {t(m.common.continueAsAGuest)}
        </Txt>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { alignItems: 'center', gap: 12, paddingVertical: 16 },
  guest: { alignSelf: 'center', paddingVertical: 4 },
  forgot: { alignSelf: 'flex-end', paddingVertical: 2 },
  guestText: { textDecorationLine: 'underline' },
});
