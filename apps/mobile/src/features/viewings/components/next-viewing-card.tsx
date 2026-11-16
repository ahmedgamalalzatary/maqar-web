import { pickField, joinParts, fmtDate, fmtTime } from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CalendarClock } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { m, initialsOf, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useUpcoming } from '../hooks/use-viewings';

/** Home's "Your next viewing" (contract §8.2): the soonest upcoming one; opens My viewings. Hidden when none. */
export function NextViewingCard() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const next = useUpcoming()[0];
  if (!next) return null;
  const title = pickField(next.property, 'title', lang);
  const when = `${fmtDate(next.date, lang, 'long')} | ${fmtTime(next.time, lang)}`;
  const cover = mediaUrl(next.property.cover);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={joinParts([`${t(m.common.yourNextViewing)}: ${title}`, when], lang)}
      onPress={() => router.push('/viewings')}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.ink, opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surface2 }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </View>
      <View style={styles.flex}>
        <View style={styles.inline}>
          <CalendarClock size={14} color={colors.accent} />
          <Txt size={11} weight="medium" style={{ color: colors.accent }}>
            {t(m.common.yourNextViewing)}
          </Txt>
        </View>
        <Txt size={14} weight="semibold" numberOfLines={1} style={{ color: colors.bg }}>
          {title}
        </Txt>
        <Txt size={12} numberOfLines={1} style={{ color: colors.bg, opacity: 0.7 }}>
          {when}
        </Txt>
      </View>
      <View style={[styles.avatar, { backgroundColor: next.agent.colour }]}>
        <Txt size={13} weight="semibold" style={styles.white}>
          {initialsOf(pickField(next.agent, 'name', lang), lang)}
        </Txt>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: radius.lg, padding: 12 },
  thumb: { width: 64, height: 64, borderRadius: radius.md, overflow: 'hidden' },
  flex: { flex: 1, gap: 2 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#fff' },
});
