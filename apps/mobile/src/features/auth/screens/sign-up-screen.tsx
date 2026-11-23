import { ErrorText } from '@/components/error-text';
import { readMobile } from '@mqr/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { m, useLang, useT } from '@/core/i18n';
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
  // Optional (App Store 5.1.1: browsing needs no number); it can be added later from the profile.
  const [phone, setPhone] = useState('');
  const badPhone = phone.trim() !== '' && !readMobile(phone);
  const ready = name.trim().length >= 2 && email.trim() !== '' && password !== '' && !badPhone;

  return (
    <Screen title={t(m.auth.createAnAccount)}>
      <Txt color="ink2" style={styles.lead}>
        {t(m.auth.saveHomesFollowPricesAnd)}
      </Txt>
      <TextField label={t(m.common.name)} value={name} onChangeText={setName} autoComplete="name" textContentType="name" />
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
        label={t(m.common.mobileNumber)}
        value={phone}
        onChangeText={setPhone}
        autoComplete="tel"
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        placeholder={t(m.auth.soYourAdvisorCanCall)}
      />
      {badPhone ? <Txt color="danger">{t(m.common.enterAValidMobileNumber)}</Txt> : null}
      <TextField
        label={t(m.common.password)}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder={t(m.auth.n8CharactersALetterAnd)}
      />
      <ErrorText message={signUp.isError ? t(authErrorMessage(signUp.error)) : undefined} trigger={signUp.submittedAt} />
      <Button
        label={t(m.auth.createAccount)}
        disabled={!ready}
        loading={signUp.isPending}
        onPress={() => {
          const mobile = readMobile(phone);
          signUp.mutate({ name: name.trim(), email: email.trim(), password, lang, ...(mobile ? { phone: mobile } : {}) });
        }}
      />
      <Button label={t(m.auth.haveAnAccountSignIn)} variant="ghost" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { marginTop: -8 },
});
