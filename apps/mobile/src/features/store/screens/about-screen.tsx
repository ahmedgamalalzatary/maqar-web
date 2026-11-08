import Constants from 'expo-constants';
import { Languages, Mail, MessageCircle, Moon, Phone, ShieldCheck } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { Card } from '@/components/card';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { useSettings } from '@/core/settings/store';
import { useTheme } from '@/core/theme';
import { STORE_INFO } from '../store-info';

/** Contact and settings for the store build. */
export function AboutScreen() {
  const t = useT();
  const lang = useLang();
  const { colors, scheme } = useTheme();
  const { setLang, setTheme } = useSettings();
  const icon = (I: typeof Phone) => <I size={20} color={colors.accentInk} strokeWidth={1.8} />;

  return (
    <Screen title={t('عن مقر', 'About Maqar')}>
      <Txt size={15} weight="semibold">
        {t('كلّمنا', 'Contact us')}
      </Txt>
      <Card style={styles.list}>
        <LinkRow icon={icon(Phone)} label={t('اتصل بينا', 'Call us')} value={STORE_INFO.phone} url={`tel:${STORE_INFO.phone.replace(/\s/g, '')}`} />
        <LinkRow icon={icon(MessageCircle)} label={t('واتساب', 'WhatsApp')} url={`https://wa.me/${STORE_INFO.whatsapp}`} />
        <LinkRow icon={icon(Mail)} label={t('الإيميل', 'Email')} value={STORE_INFO.email} url={`mailto:${STORE_INFO.email}`} />
      </Card>

      <Txt size={15} weight="semibold">
        {t('الإعدادات', 'Settings')}
      </Txt>
      <Card style={styles.list}>
        <View style={styles.row}>
          {icon(Languages)}
          <Txt style={styles.flex}>{t('اللغة', 'Language')}</Txt>
          <View style={[styles.segment, { backgroundColor: colors.surface2 }]}>
            {(['ar', 'en'] as const).map((l) => (
              <Pressable
                key={l}
                accessibilityRole="button"
                accessibilityState={{ selected: lang === l }}
                onPress={() => setLang(l)}
                style={[styles.segBtn, lang === l && { backgroundColor: colors.surface }]}
              >
                <Txt size={12} weight="medium" color={lang === l ? 'ink' : 'ink2'}>
                  {l === 'ar' ? 'العربية' : 'English'}
                </Txt>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={styles.row}>
          {icon(Moon)}
          <Txt style={styles.flex}>{t('الوضع الداكن', 'Dark mode')}</Txt>
          <Switch
            accessibilityLabel={t('الوضع الداكن', 'Dark mode')}
            value={scheme === 'dark'}
            onValueChange={(on) => setTheme(on ? 'dark' : 'light')}
            trackColor={{ true: colors.accent }}
          />
        </View>
        <LinkRow icon={icon(ShieldCheck)} label={t('سياسة الخصوصية', 'Privacy policy')} url={STORE_INFO.privacyUrl} />
      </Card>

      <View style={styles.footer}>
        <Logo width={88} />
        <Txt size={11} color="ink3" align="center">
          {t('الإصدار', 'Version')} {Constants.expoConfig?.version ?? '1.0.0'}
        </Txt>
      </View>
    </Screen>
  );
}

function LinkRow({ icon, label, value, url }: { icon: ReactNode; label: string; value?: string; url: string }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={() => Linking.openURL(url)} style={styles.row}>
      {icon}
      <Txt style={styles.flex}>{label}</Txt>
      {value ? (
        <Txt size={13} color="ink2">
          {value}
        </Txt>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  segment: { flexDirection: 'row', borderRadius: 12, padding: 2 },
  segBtn: { height: 32, paddingHorizontal: 12, borderRadius: 10, justifyContent: 'center' },
  footer: { alignItems: 'center', gap: 6, paddingTop: 16 },
  flex: { flex: 1 },
});
