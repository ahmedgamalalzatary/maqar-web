import {
  BATHS_OPTIONS,
  BEDS_OPTIONS,
  type Delivery,
  FEATURE_LABEL,
  FEATURES,
  FINISHING_LABEL,
  FINISHINGS,
  fmtMoney,
  fmtNum,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPES,
  priceScale,
  type Scale,
  SIZE_SCALE,
} from '@maqar/shared';
import { X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { useDir, useLang, useT } from '@/core/i18n';
import { fonts, radius, useTheme } from '@/core/theme';
import { clearFilters, type ExploreFilters, parseDigits } from '../filters';
import { useAreas, useDebounced, useFacets } from '../hooks/use-listings';
import { ToggleChip } from './chips';
import { bathsLabel, bedsLabel, deliveryLabel, priceTitle, sizeRangeText } from './filter-labels';
import { RangeSlider } from './range-slider';

const toggle = <T,>(list: T[] | undefined, v: T): T[] | undefined => {
  const next = list?.includes(v) ? list.filter((x) => x !== v) : [...(list ?? []), v];
  return next.length ? next : undefined;
};

/** A range with nothing set sits at the ends of the scale. */
const rangeOf = (lo: number | undefined, hi: number | undefined, s: Scale): [number, number] => [lo ?? s.min, hi ?? s.max];
/** Ends of the scale mean "no limit". */
const limitsOf = ([lo, hi]: [number, number], s: Scale) => ({ lo: lo > s.min ? lo : undefined, hi: hi < s.max ? hi : undefined });

/**
 * The filter sheet (contract §8.4). It edits a copy of the filters; "Show N homes" applies it,
 * and N comes from the API for the copy. Closing without it keeps the filters as they were.
 */
export function FilterSheet({
  filters,
  onApply,
  onClose,
}: {
  filters: ExploreFilters;
  onApply: (f: ExploreFilters) => void;
  onClose: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const dir = useDir();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState(filters);
  const facets = useFacets(useDebounced(draft, 250), true);
  const areas = useAreas();
  const set = (patch: Partial<ExploreFilters>) => setDraft((d) => ({ ...d, ...patch }));

  const price = priceScale(draft.category);
  const priceRange = rangeOf(draft.minPrice, draft.maxPrice, price);
  const sizeRange = rangeOf(draft.minSize, draft.maxSize, SIZE_SCALE);
  const years = facets.data?.deliveryYears ?? [];
  const deliveries: Delivery[] = ['ready', ...years];
  const total = facets.data?.total;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.fill}>
        <Pressable accessibilityLabel={t('إغلاق', 'Close')} style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { direction: dir, backgroundColor: colors.surface }]}>
          <View style={styles.head}>
            <Txt accessibilityRole="header" size={18} weight="semibold" style={styles.flex}>
              {t('الفلاتر', 'Filters')}
            </Txt>
            <IconButton label={t('إغلاق', 'Close')} onPress={onClose} icon={<X size={20} color={colors.ink} />} />
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <Section
              title={priceTitle(draft.category, t)}
              hint={draft.category ? undefined : t('للبيع والمشروعات', 'for sale & projects')}
            >
              <RangeSlider
                scale={price}
                value={priceRange}
                counts={facets.data?.price.max === price.max ? facets.data.price.counts : undefined}
                onChange={(v) => {
                  const { lo, hi } = limitsOf(v, price);
                  set({ minPrice: lo, maxPrice: hi });
                }}
                minLabel={t('أقل سعر', 'Minimum price')}
                maxLabel={t('أعلى سعر', 'Maximum price')}
                valueText={(v) => fmtMoney(v, lang)}
              />
              <View style={styles.boxes}>
                <NumberBox
                  label={t('من', 'Min')}
                  value={draft.minPrice}
                  emptyText={fmtNum(0, lang)}
                  onCommit={(n) =>
                    set({ minPrice: n ? Math.min(n, (draft.maxPrice ?? price.max) - price.step) : undefined })
                  }
                />
                <NumberBox
                  label={t('إلى', 'Max')}
                  value={draft.maxPrice}
                  emptyText={t('أي سعر', 'Any')}
                  onCommit={(n) =>
                    set({ maxPrice: n === undefined || n >= price.max ? undefined : Math.max(n, (draft.minPrice ?? 0) + price.step) })
                  }
                />
              </View>
            </Section>

            <Section title={t('المساحة', 'Size')} value={sizeRangeText(sizeRange[0], draft.maxSize, t, lang)}>
              <RangeSlider
                scale={SIZE_SCALE}
                value={sizeRange}
                counts={facets.data?.size.counts}
                onChange={(v) => {
                  const { lo, hi } = limitsOf(v, SIZE_SCALE);
                  set({ minSize: lo, maxSize: hi });
                }}
                minLabel={t('أقل مساحة', 'Minimum size')}
                maxLabel={t('أكبر مساحة', 'Maximum size')}
                valueText={(v) => `${fmtNum(v, lang)} ${t('م²', 'm²')}`}
              />
            </Section>

            <Section title={t('نوع الوحدة', 'Unit type')} hint={t('اختار أكتر من نوع', 'Pick any')}>
              <Chips>
                {PROPERTY_TYPES.map((k) => (
                  <ToggleChip
                    key={k}
                    label={t(PROPERTY_TYPE_LABEL[k])}
                    selected={!!draft.types?.includes(k)}
                    onPress={() => set({ types: toggle(draft.types, k) })}
                  />
                ))}
              </Chips>
            </Section>

            <Section title={t('الغرف', 'Bedrooms')} hint={t('اختار أكتر من رقم', 'Pick any')}>
              <Chips>
                {BEDS_OPTIONS.map((n) => (
                  <ToggleChip
                    key={n}
                    {...bedsLabel(n, t, lang)}
                    selected={!!draft.beds?.includes(n)}
                    onPress={() => set({ beds: toggle(draft.beds, n) })}
                  />
                ))}
              </Chips>
            </Section>

            <Section title={t('الحمامات', 'Bathrooms')}>
              <Chips>
                {BATHS_OPTIONS.map((n) => (
                  <ToggleChip
                    key={n}
                    {...bathsLabel(n, t, lang)}
                    selected={!!draft.baths?.includes(n)}
                    onPress={() => set({ baths: toggle(draft.baths, n) })}
                  />
                ))}
              </Chips>
            </Section>

            <Section title={t('المنطقة', 'Area')}>
              <Chips>
                {(areas.data ?? []).map((a) => (
                  <ToggleChip
                    key={a.id}
                    label={lang === 'ar' ? a.nameAr : a.nameEn}
                    selected={!!draft.areas?.includes(a.id)}
                    onPress={() => set({ areas: toggle(draft.areas, a.id) })}
                  />
                ))}
              </Chips>
            </Section>

            <Section title={t('الاستلام', 'Delivery')}>
              <Chips>
                {deliveries.map((d) => (
                  <ToggleChip
                    key={d}
                    {...deliveryLabel(d, t, lang)}
                    selected={!!draft.delivery?.includes(d)}
                    onPress={() => set({ delivery: toggle(draft.delivery, d) })}
                  />
                ))}
              </Chips>
            </Section>

            <Section title={t('التشطيب', 'Finishing')}>
              <Chips>
                {FINISHINGS.map((k) => (
                  <ToggleChip
                    key={k}
                    label={t(FINISHING_LABEL[k])}
                    selected={!!draft.finishing?.includes(k)}
                    onPress={() => set({ finishing: toggle(draft.finishing, k) })}
                  />
                ))}
              </Chips>
            </Section>

            <Section title={t('المميزات', 'Amenities')} hint={t('لازم تكون كلها موجودة', 'Must have all')}>
              <Chips>
                {FEATURES.map((k) => (
                  <ToggleChip
                    key={k}
                    label={t(FEATURE_LABEL[k])}
                    selected={!!draft.features?.includes(k)}
                    onPress={() => set({ features: toggle(draft.features, k) })}
                  />
                ))}
              </Chips>
            </Section>
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: colors.line, paddingBottom: insets.bottom + 12 }]}>
            <Button label={t('مسح', 'Reset')} variant="secondary" onPress={() => setDraft(clearFilters(draft))} style={styles.reset} />
            <Button
              label={
                total === undefined
                  ? t('اعرض الوحدات', 'Show homes')
                  : t(`اعرض ${fmtNum(total, 'ar')} وحدة`, `Show ${total} ${total === 1 ? 'home' : 'homes'}`)
              }
              onPress={() => onApply(draft)}
              style={styles.flex}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Section({ title, hint, value, children }: { title: string; hint?: string; value?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Txt size={14} weight="semibold" style={styles.flex}>
          {title}
        </Txt>
        {hint ? (
          <Txt size={11} color="ink3">
            {hint}
          </Txt>
        ) : null}
        {value ? (
          <Txt size={13} weight="semibold" color="accentInk">
            {value}
          </Txt>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <View style={styles.chips}>{children}</View>;
}

/**
 * A typed number, in Arabic or Latin digits. It is applied when typing ends, so the value does
 * not jump while the person types. Empty means no limit.
 */
function NumberBox({
  label,
  value,
  emptyText,
  onCommit,
}: {
  label: string;
  value: number | undefined;
  emptyText: string;
  onCommit: (n: number | undefined) => void;
}) {
  const lang = useLang();
  const { colors } = useTheme();
  const [typing, setTyping] = useState<string | null>(null);
  const commit = () => {
    if (typing !== null) onCommit(parseDigits(typing));
    setTyping(null);
  };
  return (
    <View style={[styles.box, { backgroundColor: colors.surface2 }]}>
      <Txt size={11} color="ink3">
        {label}
      </Txt>
      <TextInput
        accessibilityLabel={label}
        keyboardType="number-pad"
        returnKeyType="done"
        value={typing ?? (value === undefined ? emptyText : fmtNum(value, lang))}
        onFocus={() => setTyping(value === undefined ? '' : String(value))}
        onChangeText={setTyping}
        onBlur={commit}
        onSubmitEditing={commit}
        style={[styles.boxInput, { color: colors.ink }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4, 21, 37, 0.45)' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 4 },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 24 },
  section: { gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boxes: { flexDirection: 'row', gap: 8 },
  box: { flex: 1, height: 56, borderRadius: radius.md, paddingHorizontal: 12, justifyContent: 'center' },
  boxInput: { fontFamily: fonts.semibold, fontSize: 15, padding: 0, textAlign: 'auto' },
  footer: { flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  reset: { paddingHorizontal: 20 },
  flex: { flex: 1 },
});
