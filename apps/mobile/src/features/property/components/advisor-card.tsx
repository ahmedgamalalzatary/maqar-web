import { pickField, type ListingAgent } from '@maqar/shared';
import { BadgeCheck, Clock, Phone } from 'lucide-react-native';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { Txt } from '@/components/text';
import { m, initialsOf, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** The named sales advisor for the listing (contract §8.5). */
export function AdvisorCard({ agent }: { agent: ListingAgent }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const initials = initialsOf(pickField(agent, 'name', lang), lang, 2);

  return (
    <Card style={styles.card}>
      <Txt size={12} weight="medium" color="ink3">
        {t(m.property.yourSalesAdvisorForThis)}
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
              {pickField(agent, 'name', lang)}
            </Txt>
            <BadgeCheck size={16} color={colors.accent} />
          </View>
          <Txt size={12} color="ink2">
            {pickField(agent, 'roleTitle', lang)}
          </Txt>
          <View style={styles.stats}>
            {/* No rating is shown: there is no collection workflow, so a number would be a claim
                with nothing behind it. Deals show only once the advisor has any. */}
            {agent.dealsCount > 0 ? (
              <Txt size={11} color="ink2">
                {t(m.property.deals(agent.dealsCount))}
              </Txt>
            ) : null}
            <View style={styles.stat}>
              <Clock size={12} color={colors.ink2} />
              <Txt size={11} color="ink2">
                {t(m.property.aimsToReply(agent.avgReplyMins))}
              </Txt>
            </View>
          </View>
          <Txt size={11} color="ink3">
            {pickField(agent, 'languages', lang)}
          </Txt>
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t(m.common.call)}
        onPress={() => Linking.openURL(`tel:${agent.phone}`)}
        style={({ pressed }) => [styles.call, { backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
      >
        <Phone size={16} color={colors.accentInk} />
        <Txt size={14} weight="semibold" color="accentInk">
          {t(m.common.call)}
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
