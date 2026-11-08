import { type SignUpRole } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { Store, UserRound } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { authErrorMessage } from '../auth-errors';
import { useSignUp } from '../hooks/use-auth';

const ROLE_CHOICES = [
  { role: 'client', icon: UserRound, title: { ar: 'بدوّر على بيت', en: 'I want a home' }, body: { ar: 'دوّر، احجز معاينة، تابع الأسعار', en: 'Search, book viewings, follow prices' } },
  { role: 'owner', icon: Store, title: { ar: 'مالك عقار', en: 'Property owner' }, body: { ar: 'اعرض عقارك وتابع المهتمين', en: 'List your property, track interest' } },
] as const;

export function SignUpScreen() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const signUp = useSignUp();
  const [role, setRole] = useState<SignUpRole>('client');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const ready = name.trim().length >= 2 && email.trim() !== '' && password !== '';

  return (
    <Screen title={t('حساب جديد', 'Create an account')}>
      <View accessibilityRole="radiogroup" style={styles.roles}>
        {ROLE_CHOICES.map(({ role: r, icon: Icon, title, body }) => {
          const on = role === r;
          return (
            <Pressable
              key={r}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={`${t(title)}. ${t(body)}`}
              onPress={() => setRole(r)}
              style={[styles.role, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
            >
              <View style={[styles.icon, { backgroundColor: on ? colors.accent : colors.accentSoft }]}>
                <Icon size={20} color={on ? colors.navy : colors.accentInk} />
              </View>
              <View style={styles.flex}>
                <Txt weight="semibold" style={{ color: on ? colors.bg : colors.ink }}>
                  {t(title)}
                </Txt>
                <Txt size={12} style={{ color: on ? colors.bg : colors.ink2, opacity: on ? 0.75 : 1 }}>
                  {t(body)}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
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
        onPress={() => signUp.mutate({ name: name.trim(), email: email.trim(), password, role, lang })}
      />
      <Button label={t('عندك حساب؟ ادخل', 'Have an account? Sign in')} variant="ghost" onPress={() => router.replace('/sign-in')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  roles: { gap: 8 },
  role: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth },
  icon: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
