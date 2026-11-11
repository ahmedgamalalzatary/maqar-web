import { fmtNum, type ListingAgent } from '@maqar/shared';
import { BadgeCheck, Clock, Phone } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { Txt } from '@/components/text';
import { initialsOf, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** The named sales advisor for the listing (contract §8.5). */
export function AdvisorCard({ agent }: { agent: ListingAgent }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const initials = initialsOf(lang === 'ar' ? agent.nameAr : agent.nameEn, lang, 2);

  return (
    <Card style={styles.card}>
      <Txt size={12} weight="medium" color="ink3">
        {t('مسؤول المبيعات للوحدة دي', 'Your sales advisor for this home')}
      </Txt>
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: agent.colour }]} accessibilityElementsHidden>
          <Txt size={17} weight="semibold" style={styles.white}>
            {initials}
          </Txt>
        </View>
        <View style={styles.flex}>
          <View style={styles.name}>
            <Txt size={15} weight="semibold">
              {lang === 'ar' ? agent.nameAr : agent.nameEn}
            </Txt>
            <BadgeCheck size={16} color={colors.accent} />
          </View>
          <Txt size={12} color="ink2">
            {lang === 'ar' ? agent.roleTitleAr : agent.roleTitleEn}
          </Txt>
          <View style={styles.stats}>
            {/* No rating is shown: there is no collection workflow, so a number would be a claim
                with nothing behind it. Deals show only once the advisor has any. */}
            {agent.dealsCount > 0 ? (
              <Txt size={11} color="ink2">
                {t(`${fmtNum(agent.dealsCount, 'ar')} صفقة`, `${agent.dealsCount} deals`)}
              </Txt>
            ) : null}
            <View style={styles.stat}>
              <Clock size={12} color={colors.ink2} />
              <Txt size={11} color="ink2">
                {t(`هدفنا الرد خلال ${fmtNum(agent.avgReplyMins, 'ar')} د`, `aims to reply in ${agent.avgReplyMins}m`)}
              </Txt>
            </View>
          </View>
          <Txt size={11} color="ink3">
            {lang === 'ar' ? agent.languagesAr : agent.languagesEn}
          </Txt>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('اتصال', 'Call')}
        onPress={() => Linking.openURL(`tel:${agent.phone}`)}
        style={({ pressed }) => [styles.call, { backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
      >
        <Phone size={16} color={colors.accentInk} />
        <Txt size={14} weight="semibold" color="accentInk">
          {t('اتصال', 'Call')}
        </Txt>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
  flex: { flex: 1, gap: 2 },
  name: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stats: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  call: { height: 46, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
