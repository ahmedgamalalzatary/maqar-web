import { pickField, CATEGORY_LABEL, FEATURE_LABEL, PROPERTY_TYPE_LABEL } from '@maqar/shared';
import { useRouter } from 'expo-router';
import { SlidersHorizontal } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { Txt } from '@/components/text';
import { m, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { useAreas } from '@/features/listings/hooks/use-listings';

/**
 * "What you're looking for" on Home (owner's request, 2026-11-12): the answers a client gave after
 * sign-up, as chips, with a way to change them. A client who skipped the questions is asked to
 * answer them; guests and staff see nothing.
 */
export function MyPrefs() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const user = useSession((s) => (s.status === 'signedIn' ? s.user : null));
  const areas = useAreas();
  if (!user || user.role !== 'client') return null;
  const prefs = user.prefs;
  const edit = () => router.push('/onboarding');

  if (!prefs) {
    return (
      <View testID="my-prefs" style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Txt size={15} weight="semibold">
          {t(m.home.youHaventToldUsWhat)}
        </Txt>
        <Txt size={13} color="ink2">
          {t(m.home.answerAFewQuickQuestions)}
        </Txt>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(m.common.tellUsWhatYouWant)}
          onPress={edit}
          style={({ pressed }) => [styles.cta, { backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1 }]}
        >
          <SlidersHorizontal size={16} color={colors.accentInk} />
          <Txt size={13} weight="semibold" color="accentInk">
            {t(m.common.tellUsWhatYouWant)}
          </Txt>
        </Pressable>
      </View>
    );
  }

  const renter = prefs.purpose[0] === 'rent';
  const areaName = (id: string) => {
    const a = areas.data?.find((x) => x.id === id);
    return a ? (pickField(a, 'name', lang)) : null;
  };
  const chips = [
    ...prefs.purpose.map((c) => t(CATEGORY_LABEL[c])),
    renter
      ? t(m.home.upToMonthly(prefs.budgetMax))
      : t(m.home.upTo(prefs.budgetMax)),
    ...prefs.areas.map(areaName).filter((n): n is string => !!n),
    ...prefs.types.map((k) => t(PROPERTY_TYPE_LABEL[k])),
    ...(prefs.beds > 0 ? [t(m.home.bedsPlus(prefs.beds))] : []),
    ...prefs.interests.map((f) => t(FEATURE_LABEL[f])),
  ];

  return (
    <View testID="my-prefs" style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <View style={styles.head}>
        <SlidersHorizontal size={18} color={colors.accentInk} />
        <Txt accessibilityRole="header" size={16} weight="semibold" style={styles.flex}>
          {t(m.home.whatYoureLookingFor)}
        </Txt>
        <Pressable accessibilityRole="button" accessibilityLabel={t(m.common.editYourPreferences)} onPress={edit} hitSlop={8}>
          <Txt size={13} weight="medium" color="accentInk">
            {t(m.home.edit)}
          </Txt>
        </Pressable>
      </View>
      <View style={styles.chips}>
        {chips.map((c) => (
          <View key={c} style={[styles.chip, { backgroundColor: colors.surface2 }]}>
            <Txt size={12} weight="medium">
              {c}
            </Txt>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderWidth: 1, borderRadius: radius.lg, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  cta: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
});
