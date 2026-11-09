import { ROLE_LABEL } from '@maqar/shared';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { Calculator, ChevronLeft, ChevronRight, Languages, Moon, SlidersHorizontal, UserPen } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { Toggle } from '@/components/toggle';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useSignOut } from '@/features/auth/hooks/use-auth';
import { useSession } from '@/features/auth/store/session.store';
import { DeleteAccountSheet } from '../components/delete-account-sheet';
import { usePreferences } from '../hooks/use-account';

/** The Me tab for every role (contract §8.14). */
export function MeScreen() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const user = useSession((s) => s.user);
  const signOut = useSignOut();
  const prefs = usePreferences();
  const [deleting, setDeleting] = useState(false);
  const selfDelete = user?.role === 'client';

  return (
    <Screen title={t('حسابي', 'My account')}>
      {user ? (
        <Card style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.navy }]}>
            <Txt size={20} weight="semibold" style={{ color: colors.gold }} align="center">
              {(user.name || 'M').slice(0, 1).toUpperCase()}
            </Txt>
          </View>
          <View style={styles.flex}>
            <Txt size={17} weight="semibold" numberOfLines={1}>
              {user.name}
            </Txt>
            <Txt size={12.5} color="ink2" numberOfLines={1}>
              {user.email}
            </Txt>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
            <Txt size={11} weight="medium" color="accentInk">
              {user.agent ? t({ ar: user.agent.roleTitleAr, en: user.agent.roleTitleEn }) : t(ROLE_LABEL[user.role])}
            </Txt>
          </View>
        </Card>
      ) : (
        <Card style={styles.guest}>
          <Txt size={17} weight="semibold">
            {t('ضيف مقر', 'Maqar guest')}
          </Txt>
          <Txt color="ink2">
            {t('سجّل دخولك عشان تحفظ البيوت وتحجز معاينات.', 'Sign in to save homes and book viewings.')}
          </Txt>
          <Button label={t('تسجيل الدخول', 'Sign in')} onPress={() => router.push('/sign-in')} />
          <Button label={t('إنشاء حساب', 'Create an account')} variant="secondary" onPress={() => router.push('/sign-up')} />
        </Card>
      )}

      <Txt size={15} weight="semibold">
        {t('الإعدادات', 'Settings')}
      </Txt>
      <Card style={styles.list}>
        <Row icon={<Languages size={20} color={colors.accentInk} />} label={t('اللغة', 'Language')}>
          <View style={[styles.segment, { backgroundColor: colors.surface2 }]}>
            {(['ar', 'en'] as const).map((l) => (
              <Pressable
                key={l}
                accessibilityRole="button"
                accessibilityState={{ selected: lang === l }}
                onPress={() => prefs.setLang(l)}
                style={[styles.segBtn, lang === l && { backgroundColor: colors.surface }]}
              >
                <Txt size={12} weight="medium" color={lang === l ? 'ink' : 'ink2'}>
                  {l === 'ar' ? 'العربية' : 'English'}
                </Txt>
              </Pressable>
            ))}
          </View>
        </Row>
        <Row icon={<Moon size={20} color={colors.accentInk} />} label={t('الوضع الداكن', 'Dark mode')}>
          <Toggle
            label={t('الوضع الداكن', 'Dark mode')}
            value={scheme === 'dark'}
            onChange={(on) => prefs.setTheme(on ? 'dark' : 'light')}
          />
        </Row>
        {user ? (
          <LinkRow
            icon={<UserPen size={20} color={colors.accentInk} />}
            label={t('عدّل بياناتك', 'Edit profile')}
            onPress={() => router.push('/profile/edit')}
          />
        ) : null}
        {user?.role === 'client' ? (
          <LinkRow
            icon={<SlidersHorizontal size={20} color={colors.accentInk} />}
            label={t('عدّل تفضيلاتك', 'Edit your preferences')}
            onPress={() => router.push('/onboarding')}
          />
        ) : null}
        {!user || user.role === 'client' ? (
          <LinkRow
            icon={<Calculator size={20} color={colors.accentInk} />}
            label={t('حاسبة التقسيط', 'Installment calculator')}
            onPress={() => router.push('/calculator')}
          />
        ) : null}
      </Card>

      {user ? (
        <View style={styles.actions}>
          <Button label={t('تسجيل الخروج', 'Sign out')} variant="secondary" onPress={signOut} />
          {selfDelete ? (
            <Button label={t('امسح حسابي', 'Delete my account')} variant="ghost" onPress={() => setDeleting(true)} />
          ) : null}
        </View>
      ) : null}

      <View style={styles.footer}>
        <Logo width={88} />
        <Txt size={11} color="ink3" align="center">
          {t('الإصدار', 'Version')} {Constants.expoConfig?.version ?? '1.0.0'}
        </Txt>
      </View>

      {user ? <DeleteAccountSheet open={deleting} onClose={() => setDeleting(false)} /> : null}
    </Screen>
  );
}

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      {icon}
      <Txt style={styles.flex}>{label}</Txt>
      {children}
    </View>
  );
}

function LinkRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  const Chevron = useDir() === 'rtl' ? ChevronLeft : ChevronRight;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.row}>
      {icon}
      <Txt style={styles.flex}>{label}</Txt>
      <Chevron size={18} color={colors.ink3} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 56, height: 56, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  badge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  guest: { gap: 10 },
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 2 },
  segBtn: { height: 32, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  actions: { gap: 8 },
  footer: { alignItems: 'center', gap: 6, paddingTop: 16 },
  flex: { flex: 1 },
});
