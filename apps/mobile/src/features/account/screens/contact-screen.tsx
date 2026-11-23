import { type Bi, type ContactField, contactLinks } from '@mqr/shared';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Camera, Mail, MessageCircle, Music2, Phone } from 'lucide-react-native';
import { type ReactNode, useEffect } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { useAppConfig, useContact } from '@/core/app-config/store';
import { m, useDir, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

const WHATSAPP_GREEN = '#25D366';
const SOCIAL: { field: 'facebook' | 'instagram' | 'tiktok'; label: Bi; color: string }[] = [
  { field: 'instagram', label: m.account.instagram, color: '#E1306C' },
  { field: 'facebook', label: m.account.facebook, color: '#1877F2' },
  { field: 'tiktok', label: m.account.tiktok, color: '#111111' },
];

/**
 * `/contact` (owner, 2026-11-14): the ways to reach MQR that an admin fills in under App settings.
 * Only filled details show. It asks the server for the latest when it opens.
 */
export function ContactScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const BackIcon = useDir() === 'rtl' ? ArrowRight : ArrowLeft;
  const contact = useContact();
  const links = contactLinks(contact);
  useEffect(() => {
    void useAppConfig.getState().refresh();
  }, []);
  const open = (url: string | null) => {
    if (url) void Linking.openURL(url).catch(() => {});
  };
  const social = SOCIAL.filter((s) => links[s.field]);
  const anything = (Object.keys(links) as ContactField[]).some((f) => links[f]);

  return (
    <Screen
      title={t(m.common.contactUs)}
      right={
        <IconButton
          label={t(m.common.back)}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          icon={<BackIcon size={20} color={colors.ink} />}
        />
      }
    >
      {!anything ? (
        <Txt color="ink2">{t(m.account.noContactDetailsYet)}</Txt>
      ) : null}

      {links.email || links.phone ? (
        <Section title={t(m.account.contactDetails)}>
          {links.email ? (
            <Detail icon={<Mail size={20} color="#EA4335" />} label={t(m.common.email)} value={contact.email.trim()} onPress={() => open(links.email)} />
          ) : null}
          {links.phone ? (
            <Detail icon={<Phone size={20} color={colors.accentInk} />} label={t(m.account.phoneNumber)} value={contact.phone.trim()} onPress={() => open(links.phone)} />
          ) : null}
        </Section>
      ) : null}

      {social.length ? (
        <Section title={t(m.account.socialMedia)}>
          <View style={styles.social}>
            {social.map((s) => (
              <Pressable key={s.field} accessibilityRole="link" accessibilityLabel={t(s.label)} onPress={() => open(links[s.field])} style={styles.socialItem}>
                <View style={[styles.badge, { backgroundColor: s.color }]}>
                  {s.field === 'facebook' ? (
                    <Txt size={22} weight="semibold" style={styles.white}>
                      f
                    </Txt>
                  ) : s.field === 'instagram' ? (
                    <Camera size={22} color="#fff" />
                  ) : (
                    <Music2 size={22} color="#fff" />
                  )}
                </View>
                <Txt size={13}>{t(s.label)}</Txt>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      {links.whatsapp ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(m.common.chatOnWhatsapp)}
          onPress={() => open(links.whatsapp)}
          style={[styles.whatsapp, { borderColor: WHATSAPP_GREEN }]}
        >
          <MessageCircle size={20} color={WHATSAPP_GREEN} />
          <Txt weight="semibold" style={{ color: WHATSAPP_GREEN }}>
            {t(m.common.chatOnWhatsapp)}
          </Txt>
        </Pressable>
      ) : null}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.section}>
      <View style={[styles.sectionHead, { borderColor: colors.accent }]}>
        <Txt size={15} weight="semibold">
          {title}
        </Txt>
      </View>
      {children}
    </Card>
  );
}

function Detail({ icon, label, value, onPress }: { icon: ReactNode; label: string; value: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`${label}: ${value}`} onPress={onPress} style={[styles.detail, { backgroundColor: colors.surface2 }]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>{icon}</View>
      <View style={styles.flex}>
        <Txt size={12} color="ink3">
          {label}
        </Txt>
        {/* Addresses and numbers read left to right in both languages. */}
        <Txt size={15} weight="medium" style={styles.ltr}>
          {value}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionHead: { borderStartWidth: 3, paddingStart: 8 },
  detail: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.md, padding: 12 },
  iconWrap: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  social: { flexDirection: 'row', justifyContent: 'space-around' },
  socialItem: { alignItems: 'center', gap: 8, minWidth: 72 },
  badge: { width: 52, height: 52, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  whatsapp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderRadius: radius.full, minHeight: 48 },
  ltr: { writingDirection: 'ltr' },
  flex: { flex: 1 },
});
