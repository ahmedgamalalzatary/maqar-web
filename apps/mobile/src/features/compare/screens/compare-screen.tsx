import {
  type Better,
  CATEGORY_LABEL,
  compareMonthly,
  compareVerdict,
  DEFAULT_PREFS,
  type Feature,
  FEATURE_LABEL,
  FINISHING_LABEL,
  fmtMoney,
  fmtNum,
  fmtPct,
  localDigits,
  matchScore,
  PROPERTY_TYPE_LABEL,
  type PropertyCard,
  type PropertyDetail,
  winner,
} from '@maqar/shared';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowLeftRight, ArrowRight, Check, Crown, Minus, Plus, Scale, Sparkles, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { Sheet } from '@/components/sheet';
import { TextField } from '@/components/text-field';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { ListingsError } from '@/features/listings/components/list-states';
import { useDebounced, useProperties } from '@/features/listings/hooks/use-listings';
import { useSaved } from '@/features/saved/hooks/use-saved';
import { useCompareHomes } from '../hooks/use-compare-homes';
import { useCompare } from '../store/compare.store';

const SLOTS = [0, 1] as const;
type Slot = (typeof SLOTS)[number];
const LETTER = ['A', 'B'] as const;

/** `/compare` (contract §8.10): two homes side by side, the better value marked, and a verdict. */
export function CompareScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const BackIcon = useDir() === 'rtl' ? ArrowRight : ArrowLeft;
  const { ids, query } = useCompareHomes();
  const remove = useCompare((s) => s.remove);
  const [picking, setPicking] = useState<Slot | null>(null);

  const byId = new Map((query.data ?? []).map((h) => [h.id, h]));
  const slots = SLOTS.map((i) => (ids[i] === undefined ? undefined : byId.get(ids[i])));
  const [a, b] = slots;
  const loading = ids.length > 0 && query.isPending;

  return (
    <Screen
      title={t('قارن الوحدات', 'Compare homes')}
      right={
        <IconButton
          label={t('رجوع', 'Back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/explore'))}
          icon={<BackIcon size={20} color={colors.ink} />}
        />
      }
    >
      <Txt size={13} color="ink2" style={styles.subtitle}>
        {t('جنب بعض، بالأرقام', 'Side by side, in numbers')}
      </Txt>

      {query.isError && !query.data ? (
        <ListingsError onRetry={() => void query.refetch()} />
      ) : (
        <View style={styles.heads}>
          {SLOTS.map((i) => {
            const home = slots[i];
            if (home) return <Head key={home.id} home={home} slot={i} onChange={() => setPicking(i)} onRemove={() => remove(home.id)} />;
            if (ids[i] !== undefined && loading) return <Loading key={`loading-${i}`} />;
            return <EmptySlot key={`empty-${i}`} onPress={() => setPicking(i)} />;
          })}
        </View>
      )}

      {a && b ? (
        <Table a={a} b={b} />
      ) : loading ? null : (
        <View style={[styles.hint, { backgroundColor: colors.navy }]}>
          <Scale size={20} color={colors.gold} />
          <Txt size={13} style={[styles.flex, { color: colors.cream, opacity: 0.8 }]}>
            {t(
              'اختار وحدتين عشان نقارنهم في السعر، سعر المتر، القسط، المساحة والمميزات، ونقولك مين الأحسن في إيه.',
              'Pick two homes and we’ll compare price, price per m², installment, size and amenities, and tell you which wins where.',
            )}
          </Txt>
        </View>
      )}

      <PickSheet slot={picking} other={picking === null ? undefined : slots[picking === 0 ? 1 : 0]} onClose={() => setPicking(null)} />
    </Screen>
  );
}

/** The rows, once both homes are picked. */
function Table({ a, b }: { a: PropertyDetail; b: PropertyDetail }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const prefs = useSession((s) => (s.user?.role === 'client' ? (s.user.prefs ?? DEFAULT_PREFS) : null));
  const pair = [a, b] as const;
  const scores = prefs
    ? (pair.map((p) => matchScore({ ...p, plan: p.plan !== null }, prefs).score) as [number, number])
    : undefined;
  const verdict = compareVerdict(a, b, scores);
  const sameCategory = a.category === b.category;
  const monthly = pair.map(compareMonthly);
  const drops = pair.map((p) => (p.oldPrice && p.oldPrice > p.price ? p.oldPrice - p.price : 0));
  const suffix = (p: PropertyDetail) => (p.category === 'rent' ? t(' / شهر', ' / mo') : p.category === 'stay' ? t(' / ليلة', ' / night') : '');
  const features = [...new Set([...a.features, ...b.features])] as Feature[];
  const num = (f: (p: PropertyDetail) => number) => pair.map(f) as unknown as [number, number];

  return (
    <>
      {verdict.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.inline}>
            <Sparkles size={16} color={colors.accent} />
            <Txt size={14} weight="semibold">
              {t('الخلاصة', 'The short version')}
            </Txt>
          </View>
          {verdict.map((v) => (
            <View key={v.text.en} style={styles.inline}>
              <Letter slot={v.who} />
              <Txt size={13} style={styles.flex}>
                {t(v.text)}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}

      <Group title={t('السعر والتكلفة', 'Price & cost')}>
        <Row
          label={t('السعر', 'Price')}
          better={sameCategory ? 'low' : null}
          vals={num((p) => p.price)}
          fmt={(v, i) => `${fmtMoney(v, lang)}${suffix(pair[i])}`}
        />
        <Row
          label={t('سعر المتر', 'Price per m²')}
          better={sameCategory ? 'low' : null}
          vals={num((p) => p.price / p.sizeM2)}
          fmt={(v) => fmtMoney(Math.round(v), lang, false)}
        />
        {monthly[0] || monthly[1] ? (
          <Row
            label={t('القسط الشهري', 'Monthly installment')}
            better="low"
            vals={[monthly[0]?.payment ?? null, monthly[1]?.payment ?? null]}
            fmt={(v, i) => {
              const m = monthly[i]!;
              const terms = `${t(`مقدم ${fmtPct(m.downPct, 'ar')} على ${fmtNum(m.years, 'ar')} سنين`, `${m.downPct}% down over ${m.years}y`)}`;
              // A home with no plan is judged on assumed terms; the cell says so.
              return `${fmtMoney(Math.round(v), lang)}\n${m.estimated ? `${terms} ${t('(تقديري)', '(estimated)')}` : terms}`;
            }}
          />
        ) : null}
        <Row
          label={t('الصيانة', 'Maintenance')}
          better="low"
          vals={[a.maintenanceFee, b.maintenanceFee]}
          fmt={(v) => fmtPct(v, lang)}
        />
        {drops[0] || drops[1] ? (
          <Row
            label={t('نزول السعر', 'Price drop')}
            better="high"
            vals={drops as [number, number]}
            fmt={(v) => (v ? `-${fmtMoney(v, lang)}` : '—')}
          />
        ) : null}
      </Group>

      <Group title={t('المساحة والتفاصيل', 'Size & details')}>
        <Row label={t('المساحة', 'Size')} better="high" vals={num((p) => p.sizeM2)} fmt={(v) => `${fmtNum(v, lang)} ${t('م²', 'm²')}`} />
        <Row label={t('الغرف', 'Bedrooms')} better="high" vals={num((p) => p.beds)} fmt={(v) => fmtNum(v, lang)} />
        <Row label={t('الحمامات', 'Bathrooms')} better="high" vals={num((p) => p.baths)} fmt={(v) => fmtNum(v, lang)} />
        <TextRow label={t('النوع', 'Type')} vals={[t(PROPERTY_TYPE_LABEL[a.type]), t(PROPERTY_TYPE_LABEL[b.type])]} />
        <TextRow label={t('التشطيب', 'Finishing')} vals={[t(FINISHING_LABEL[a.finishing]), t(FINISHING_LABEL[b.finishing])]} />
        <Row
          label={t('الاستلام', 'Delivery')}
          better="low"
          vals={num((p) => (p.delivery === 'ready' ? 0 : p.delivery))}
          fmt={(v) => (v === 0 ? t('فوري', 'Ready') : localDigits(String(v), lang))}
        />
        <TextRow
          label={t('الدور', 'Floor')}
          vals={[a.floor !== null ? fmtNum(a.floor, lang) : '—', b.floor !== null ? fmtNum(b.floor, lang) : '—']}
        />
      </Group>

      <Group title={t('الموقع', 'Location')}>
        <TextRow label={t('المنطقة', 'Area')} vals={[t({ ar: a.area.nameAr, en: a.area.nameEn }), t({ ar: b.area.nameAr, en: b.area.nameEn })]} />
        <TextRow label={t('الكمبوند', 'Compound')} vals={[t({ ar: a.compoundAr, en: a.compoundEn }), t({ ar: b.compoundAr, en: b.compoundEn })]} />
      </Group>

      <Group title={t('المميزات', 'Amenities')}>
        {/* The amenities either home has, then the 360° tour, as in the demo. */}
        {[
          ...features.map((f) => ({ key: f, label: t(FEATURE_LABEL[f]), on: [a.features.includes(f), b.features.includes(f)] })),
          { key: 'tour', label: t('جولة ٣٦٠°', '360° tour'), on: [a.tour, b.tour] },
        ].map((row, i) => (
          <View
            key={row.key}
            style={[styles.amenity, i < features.length && { borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <Yes on={row.on[0]!} label={`${row.label} A`} />
            <Txt size={12} color="ink2" align="center" style={styles.amenityLabel}>
              {row.label}
            </Txt>
            <Yes on={row.on[1]!} label={`${row.label} B`} />
          </View>
        ))}
      </Group>
      {/* No "Demand" (views) group: removed by the owner on 2026-11-12. */}
    </>
  );
}

/** A picked home at the top of its column. */
function Head({ home, slot, onChange, onRemove }: { home: PropertyDetail; slot: Slot; onChange: () => void; onRemove: () => void }) {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const { colors } = useTheme();
  const cover = mediaUrl(home.cover);
  const title = lang === 'ar' ? home.titleAr : home.titleEn;
  return (
    <View style={[styles.head, { backgroundColor: colors.surface, borderColor: colors.line }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => router.push(`/property/${home.id}`)}>
        <View style={[styles.headPhoto, { backgroundColor: colors.surface2 }]}>
          {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <View style={styles.shade} />
          <View style={styles.headLetter}>
            <Letter slot={slot} />
          </View>
          <View style={styles.headPrice}>
            <Txt size={14} weight="semibold" style={styles.white}>
              {fmtMoney(home.price, lang)}
            </Txt>
            <Txt size={10.5} style={[styles.white, { opacity: 0.8 }]}>
              {t(CATEGORY_LABEL[home.category])}
            </Txt>
          </View>
        </View>
      </Pressable>
      <View style={styles.headBody}>
        <Txt size={12.5} weight="medium" numberOfLines={2} style={styles.headTitle}>
          {title}
        </Txt>
        <View style={styles.headActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(`غيّر ${LETTER[slot]}`, `Change ${LETTER[slot]}`)}
            onPress={onChange}
            style={({ pressed }) => [styles.change, { backgroundColor: colors.surface2, opacity: pressed ? 0.8 : 1 }]}
          >
            <ArrowLeftRight size={14} color={colors.ink} />
            <Txt size={11.5} weight="medium">
              {t('غيّر', 'Change')}
            </Txt>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(`شيل ${LETTER[slot]}`, `Remove ${LETTER[slot]}`)}
            onPress={onRemove}
            style={({ pressed }) => [styles.removeBtn, { backgroundColor: colors.surface2, opacity: pressed ? 0.8 : 1 }]}
          >
            <X size={14} color={colors.ink2} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function EmptySlot({ onPress }: { onPress: () => void }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('اختار وحدة', 'Pick a home')}
      onPress={onPress}
      style={({ pressed }) => [styles.emptySlot, { borderColor: colors.line2, backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.plus, { backgroundColor: colors.accentSoft }]}>
        <Plus size={24} color={colors.accentInk} />
      </View>
      <Txt size={13} weight="medium" color="ink2">
        {t('اختار وحدة', 'Pick a home')}
      </Txt>
    </Pressable>
  );
}

function Loading() {
  const { colors } = useTheme();
  return (
    <View style={[styles.emptySlot, { borderColor: colors.line, backgroundColor: colors.surface, borderStyle: 'solid' }]}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** "A" in gold or "B" in sage, as in the demo. */
function Letter({ slot }: { slot: Slot }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.letter, { backgroundColor: slot === 0 ? colors.accent : colors.sage }]}>
      <Txt size={11} weight="bold" style={{ color: slot === 0 ? colors.navy : '#fff' }}>
        {LETTER[slot]}
      </Txt>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Txt accessibilityRole="header" size={14} weight="semibold" style={styles.groupTitle}>
        {title}
      </Txt>
      <View style={[styles.groupBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>{children}</View>
    </View>
  );
}

/** A row of numbers. The better side is tinted gold with a crown, and screen readers hear "better". */
function Row({
  label,
  vals,
  better,
  fmt,
}: {
  label: string;
  vals: [number | null, number | null];
  better: Better;
  fmt: (v: number, i: Slot) => string;
}) {
  const t = useT();
  const { colors } = useTheme();
  const w = winner(vals, better);
  return (
    <Cells label={label}>
      {SLOTS.map((i) => {
        const v = vals[i];
        const text = v === null ? '—' : fmt(v, i);
        const best = w === i;
        return (
          <View
            key={i}
            accessible
            accessibilityLabel={best ? t(`${label} ${LETTER[i]}: ${text}، الأفضل`, `${label} ${LETTER[i]}: ${text}, better`) : `${label} ${LETTER[i]}: ${text}`}
            style={[styles.cell, { backgroundColor: best ? colors.accentSoft : colors.surface2 }]}
          >
            {best ? <Crown size={14} color={colors.accent} fill={colors.accent} style={styles.crown} /> : null}
            <Txt size={13} weight="semibold" align="center" color={best ? 'accentInk' : 'ink'}>
              {text}
            </Txt>
          </View>
        );
      })}
    </Cells>
  );
}

function TextRow({ label, vals }: { label: string; vals: [string, string] }) {
  const { colors } = useTheme();
  const same = vals[0] === vals[1];
  return (
    <Cells label={label}>
      {SLOTS.map((i) => (
        <View key={i} style={[styles.cell, { backgroundColor: colors.surface2 }]}>
          <Txt size={13} weight="medium" align="center" color={same ? 'ink2' : 'ink'}>
            {vals[i]}
          </Txt>
        </View>
      ))}
    </Cells>
  );
}

function Cells({ label, children }: { label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.line }]}>
      <Txt size={11} weight="medium" color="ink3" align="center">
        {label}
      </Txt>
      <View style={styles.cells}>{children}</View>
    </View>
  );
}

function Yes({ on, label }: { on: boolean; label: string }) {
  const t = useT();
  const { colors } = useTheme();
  return (
    <View style={styles.yesWrap} accessible accessibilityLabel={`${label}: ${on ? t('موجود', 'yes') : t('مش موجود', 'no')}`}>
      <View style={[styles.yes, { backgroundColor: on ? colors.successSoft : colors.surface2 }]}>
        {on ? <Check size={16} color={colors.success} strokeWidth={3} /> : <Minus size={16} color={colors.ink3} />}
      </View>
    </View>
  );
}

/** Pick a home for a slot: saved homes first, then the other home's category. Search by area or compound. */
function PickSheet({ slot, other, onClose }: { slot: Slot | null; other?: PropertyDetail; onClose: () => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const setSlot = useCompare((s) => s.setSlot);
  const [q, setQ] = useState('');
  const search = useDebounced(q.trim(), 300);
  const open = slot !== null;
  const list = useProperties({ q: search || undefined, limit: 50 });
  const savedCards = useSaved((cards) => cards);
  const savedIds = savedCards.data?.map((c) => c.id) ?? [];
  const rank = (c: PropertyCard) => (savedIds.includes(c.id) ? 0 : 2) + (other && c.category === other.category ? 0 : 1);
  // The searched window is only the newest 50: the saved homes join it whatever it holds, so an
  // older saved home is always pickable.
  const needle = search.toLowerCase();
  const matches = (c: PropertyCard) => !needle || c.titleAr.toLowerCase().includes(needle) || c.titleEn.toLowerCase().includes(needle);
  const homes = [...(savedCards.data ?? []), ...(list.data?.items ?? [])]
    .filter((c, i, all) => c.id !== other?.id && matches(c) && all.findIndex((x) => x.id === c.id) === i)
    .sort((x, y) => rank(x) - rank(y));

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={t('اختار وحدة للمقارنة', 'Pick a home to compare')}>
      <TextField
        label={t('ابحث بالمنطقة أو الكمبوند', 'Search by area or compound')}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
      />
      <ScrollView style={styles.pickList} contentContainerStyle={styles.pickContent} keyboardShouldPersistTaps="handled">
        {list.isPending ? <ActivityIndicator color={colors.accent} /> : null}
        {list.isError ? <ListingsError onRetry={() => void list.refetch()} /> : null}
        {list.isSuccess && !homes.length ? (
          <Txt size={13} color="ink2" align="center">
            {t('مفيش وحدات بالاسم ده.', 'No homes match that.')}
          </Txt>
        ) : null}
        {homes.map((c) => {
          const cover = mediaUrl(c.cover);
          const title = lang === 'ar' ? c.titleAr : c.titleEn;
          return (
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={title}
              onPress={() => {
                if (slot !== null) setSlot(slot, { id: c.id, cover: c.cover });
                close();
              }}
              style={({ pressed }) => [styles.pick, { backgroundColor: colors.surface, borderColor: colors.line, opacity: pressed ? 0.85 : 1 }]}
            >
              <View style={[styles.pickPhoto, { backgroundColor: colors.surface2 }]}>
                {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={styles.flex}>
                <Txt size={13.5} weight="medium" numberOfLines={1}>
                  {title}
                </Txt>
                <Txt size={11.5} color="ink2" numberOfLines={1}>
                  {lang === 'ar' ? `${c.compoundAr} | ${c.area.nameAr}` : `${c.compoundEn} | ${c.area.nameEn}`}
                </Txt>
                <Txt size={13} weight="semibold">
                  {fmtMoney(c.price, lang)}
                </Txt>
              </View>
              {savedIds.includes(c.id) ? (
                <View style={[styles.savedBadge, { backgroundColor: colors.accentSoft }]}>
                  <Txt size={11} weight="medium" color="accentInk">
                    {t('محفوظة', 'Saved')}
                  </Txt>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  white: { color: '#fff' },
  subtitle: { marginTop: -12 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heads: { flexDirection: 'row', gap: 10 },
  head: { flex: 1, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  headPhoto: { aspectRatio: 4 / 3.4 },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.25)' },
  headLetter: { position: 'absolute', top: 8, start: 8 },
  headPrice: { position: 'absolute', bottom: 8, start: 10, end: 10 },
  headBody: { padding: 10, gap: 8 },
  headTitle: { minHeight: 38 },
  headActions: { flexDirection: 'row', gap: 6 },
  change: { flex: 1, height: 32, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  removeBtn: { width: 32, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptySlot: {
    flex: 1,
    aspectRatio: 4 / 5.4,
    borderRadius: 24,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  plus: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  hint: { flexDirection: 'row', gap: 12, borderRadius: 24, padding: 16 },
  card: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 10 },
  letter: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  group: { gap: 8 },
  groupTitle: { paddingHorizontal: 4 },
  groupBox: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  row: { paddingHorizontal: 12, paddingVertical: 10, gap: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 8, justifyContent: 'center' },
  crown: { position: 'absolute', top: -6, end: 6 },
  amenity: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  amenityLabel: { width: 96 },
  yesWrap: { flex: 1, alignItems: 'center' },
  yes: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pickList: { maxHeight: 420 },
  pickContent: { gap: 8, paddingBottom: 8 },
  pick: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 8 },
  pickPhoto: { width: 56, height: 56, borderRadius: 12, overflow: 'hidden' },
  savedBadge: { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
});
