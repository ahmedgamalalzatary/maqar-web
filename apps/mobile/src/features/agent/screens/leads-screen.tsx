import { fmtNum, LEAD_STAGE_COLOUR, LEAD_STAGE_LABEL, LEAD_STAGES, type LeadStage } from '@maqar/shared';
import { Search, Users, X } from 'lucide-react-native';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/components/text';
import { useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { CardSkeleton, ListingsError } from '@/features/listings/components/list-states';
import { LeadRow } from '../components/lead-parts';
import { useLeads } from '../hooks/use-agent';

type Filter = LeadStage | 'all';

/** Arabic is matched without its letter variants (أ إ آ ا, ة ه, ى ي), so "احمد" finds "أحمد". */
const fold = (s: string) => s.toLowerCase().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي');

/** `/agent/leads` (contract §10.2): every lead, filtered by stage and name, the latest activity first. */
export function LeadsScreen({ stage }: { stage?: LeadStage }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const leads = useLeads();
  const [filter, setFilter] = useState<Filter>(stage ?? 'all');
  const [q, setQ] = useState('');
  // Today's pipeline opens this tab on a stage; it may already be open on another.
  const [shown, setShown] = useState(stage);
  if (stage !== shown) {
    setShown(stage);
    if (stage) setFilter(stage);
  }

  const all = leads.data ?? [];
  const list = all.filter((l) => (filter === 'all' || l.stage === filter) && (!q.trim() || fold(l.name).includes(fold(q.trim()))));
  const count = (s: Filter) => (s === 'all' ? all.length : all.filter((l) => l.stage === s).length);

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}
      data={leads.isSuccess ? list : []}
      keyExtractor={(l) => String(l.id)}
      renderItem={({ item }) => <LeadRow lead={item} />}
      ItemSeparatorComponent={() => <View style={styles.gap} />}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <View>
            <Txt accessibilityRole="header" size={24} weight="semibold">
              {t('عملائي', 'My leads')}
            </Txt>
            {leads.isSuccess ? (
              <Txt size={13} color="ink2">
                {t(`${fmtNum(all.length, 'ar')} عميل مخصصين ليك`, `${all.length} clients assigned to you`)}
              </Txt>
            ) : null}
          </View>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Search size={18} color={colors.ink3} />
            <TextInput
              accessibilityLabel={t('ابحث باسم العميل', 'Search by client name')}
              value={q}
              onChangeText={setQ}
              placeholder={t('ابحث باسم العميل', 'Search by client name')}
              placeholderTextColor={colors.ink3}
              autoCorrect={false}
              style={[styles.input, { color: colors.ink }]}
            />
            {q ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t('امسح البحث', 'Clear search')} onPress={() => setQ('')} hitSlop={8}>
                <X size={16} color={colors.ink3} />
              </Pressable>
            ) : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.bleed} contentContainerStyle={styles.chips}>
            {(['all', ...LEAD_STAGES] as Filter[]).map((s) => {
              const on = filter === s;
              const label = s === 'all' ? t('الكل', 'All') : t(LEAD_STAGE_LABEL[s]);
              return (
                <Pressable
                  key={s}
                  accessibilityRole="radio"
                  accessibilityLabel={`${label}، ${fmtNum(count(s), lang)}`}
                  accessibilityState={{ checked: on }}
                  onPress={() => setFilter(s)}
                  style={[styles.chip, { backgroundColor: on ? colors.ink : colors.surface, borderColor: colors.line }]}
                >
                  {s !== 'all' ? <View style={[styles.dot, { backgroundColor: LEAD_STAGE_COLOUR[s] }]} /> : null}
                  <Txt size={13} weight="medium" style={{ color: on ? colors.bg : colors.ink }}>
                    {`${label} | ${fmtNum(count(s), lang)}`}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        leads.isPending ? (
          <CardSkeleton />
        ) : leads.isError ? (
          <ListingsError onRetry={() => void leads.refetch()} />
        ) : (
          <View style={styles.empty}>
            <Users size={32} color={colors.ink3} strokeWidth={1.6} />
            <Txt weight="medium" align="center">
              {all.length ? t('مفيش عملاء هنا', 'No leads here') : t('لسه مفيش عملاء', 'No leads yet')}
            </Txt>
            <Txt size={13} color="ink2" align="center">
              {all.length
                ? t('جرّب مرحلة تانية أو امسح البحث.', 'Try another stage or clear the search.')
                : t('أول ما عميل يحجز معاينة لوحدة من وحداتك هيظهر هنا.', 'As soon as a client books a viewing of one of your homes, they show up here.')}
            </Txt>
          </View>
        )
      }
      refreshControl={<RefreshControl refreshing={leads.isRefetching} onRefresh={() => void leads.refetch()} tintColor={colors.accent} />}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  header: { gap: 14, marginBottom: 16 },
  gap: { height: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 46, borderRadius: radius.lg, borderWidth: 1, paddingHorizontal: 14 },
  input: { flex: 1, fontFamily: fonts.regular, fontSize: 14, paddingVertical: 0 },
  bleed: { marginHorizontal: -16 },
  chips: { gap: 8, paddingHorizontal: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, borderWidth: 1, paddingHorizontal: 14, minHeight: 38 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48, paddingHorizontal: 24 },
});
