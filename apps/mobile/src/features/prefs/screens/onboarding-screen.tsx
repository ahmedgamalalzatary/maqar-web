import {
  BUDGET_SCALE,
  type Category,
  DEFAULT_PREFS,
  FEATURE_LABEL,
  type Feature,
  fmtMoney,
  fmtNum,
  localDigits,
  PREFS_BEDS_MAX,
  type Prefs,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPES,
  type PropertyType,
} from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { useDir, useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { useSession } from '@/features/auth/store/session.store';
import { ToggleChip } from '@/features/listings/components/chips';
import { parseDigits } from '@/features/listings/filters';
import { useAreas, useDebounced } from '@/features/listings/hooks/use-listings';
import { BudgetSlider } from '../components/budget-slider';
import { useMatchCount, useSavePrefs } from '../hooks/use-prefs';

const STEPS = 5;

const PURPOSES: { key: Category; title: { ar: string; en: string }; sub: { ar: string; en: string }; image: string }[] = [
  { key: 'sale', title: { ar: 'شراء', en: 'Buy' }, sub: { ar: 'بيتك الجاي', en: 'Your next home' }, image: '/uploads/seed/p6.jpg' },
  { key: 'rent', title: { ar: 'إيجار', en: 'Rent' }, sub: { ar: 'شهري أو سنوي', en: 'Monthly or yearly' }, image: '/uploads/seed/p9.jpg' },
  { key: 'project', title: { ar: 'مشروعات جديدة', en: 'New projects' }, sub: { ar: 'بالتقسيط', en: 'On installments' }, image: '/uploads/seed/p21.jpg' },
  { key: 'stay', title: { ar: 'إقامة قصيرة', en: 'Stays' }, sub: { ar: 'الساحل والسخنة', en: 'Coast & Sokhna' }, image: '/uploads/seed/p19.jpg' },
];

/** The must-haves onboarding offers, as in the demo. */
const INTERESTS: Feature[] = ['pool', 'garden', 'sea', 'smart', 'gym', 'clubhouse', 'parking', 'roof'];

/** A rent budget to start from when the saved one is a purchase budget, and the other way round. */
const RENT_START = 50_000;

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Onboarding and "Edit your preferences" (contract §8.1): name and purpose, budget, areas, unit
 * types, then bedrooms and must-haves with a live count of the homes that fit 70% or more.
 * After sign-up it ends on Home; reopened from Me it starts from the saved preferences and goes back.
 */
export function OnboardingScreen() {
  const t = useT();
  const lang = useLang();
  const rtl = useDir() === 'rtl';
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useSession((s) => s.user);
  const saved = user?.prefs ?? null;
  const start = saved ?? DEFAULT_PREFS;
  const save = useSavePrefs();

  const [step, setStep] = useState(0);
  const [name, setName] = useState(user?.name ?? '');
  const [purpose, setPurpose] = useState<Category[]>(start.purpose);
  const [rentBudget, setRentBudget] = useState(start.purpose[0] === 'rent' ? start.budgetMax : RENT_START);
  const [buyBudget, setBuyBudget] = useState(start.purpose[0] === 'rent' ? DEFAULT_PREFS.budgetMax : start.budgetMax);
  const [areas, setAreas] = useState<string[]>(start.areas);
  const [types, setTypes] = useState<PropertyType[]>(start.types);
  const [beds, setBeds] = useState(start.beds);
  const [interests, setInterests] = useState<Feature[]>(start.interests);

  const renter = purpose[0] === 'rent';
  const scale = renter ? BUDGET_SCALE.rent : BUDGET_SCALE.buy;
  const budget = renter ? rentBudget : buyBudget;
  const setBudget = renter ? setRentBudget : setBuyBudget;
  const prefs: Prefs = useMemo(
    () => ({ purpose, budgetMax: budget, areas, types, beds, interests }),
    [purpose, budget, areas, types, beds, interests],
  );
  const count = useMatchCount(useDebounced(prefs, 300));

  const finish = () => {
    const clean = name.trim();
    save.mutate(
      { prefs, name: clean.length >= 2 && clean !== user?.name ? clean : undefined },
      { onSuccess: () => (saved ? router.back() : router.replace('/')) },
    );
  };

  const last = step === STEPS - 1;
  const Back = rtl ? ArrowRight : ArrowLeft;

  return (
    <View style={[styles.fill, { backgroundColor: colors.bg, paddingTop: insets.top + 12 }]}>
      <View style={styles.top}>
        {step > 0 ? (
          <IconButton label={t('رجوع', 'Back')} onPress={() => setStep((s) => s - 1)} icon={<Back size={20} color={colors.ink} />} />
        ) : (
          <View style={styles.topSpace} />
        )}
        <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: STEPS }, (_, i) => (
            <View key={i} style={[styles.dash, { backgroundColor: i <= step ? colors.accent : colors.surface3 }]} />
          ))}
        </View>
        {saved ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Txt size={13} weight="medium" color="ink2">
              {t('إلغاء', 'Cancel')}
            </Txt>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={finish} disabled={save.isPending} hitSlop={8}>
            <Txt size={13} weight="medium" color="ink2">
              {t('تخطي', 'Skip')}
            </Txt>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {step === 0 ? (
          <>
            <Title
              title={saved ? t('عدّل تفضيلاتك', 'Edit your preferences') : t('أهلاً بيك في مقر', 'Welcome to Maqar')}
              sub={t('أسئلة سريعة ونرشحلك العقارات اللي تناسبك فعلاً.', 'A few quick questions and we’ll suggest homes that actually fit you.')}
            />
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t('اسمك (اختياري)', 'Your name (optional)')}
              </Txt>
              <TextInput
                accessibilityLabel={t('اسمك (اختياري)', 'Your name (optional)')}
                value={name}
                onChangeText={setName}
                placeholder={t('مثلاً: أحمد', 'e.g. Ahmed')}
                placeholderTextColor={colors.ink3}
                autoComplete="name"
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.ink, textAlign: rtl ? 'right' : 'left' }]}
              />
            </View>
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t('بتدور على إيه؟', 'What are you looking for?')}
              </Txt>
              <View style={styles.grid}>
                {PURPOSES.map((p) => {
                  const on = purpose.includes(p.key);
                  const img = mediaUrl(p.image);
                  return (
                    <Pressable
                      key={p.key}
                      accessibilityRole="checkbox"
                      accessibilityLabel={t(p.title)}
                      accessibilityState={{ checked: on }}
                      // A new purpose goes first: it decides how the budget reads. The last one stays.
                      onPress={() => setPurpose((list) => (list.includes(p.key) ? (list.length > 1 ? list.filter((k) => k !== p.key) : list) : [p.key, ...list]))}
                      style={[styles.purpose, { borderColor: on ? colors.accent : colors.line, borderWidth: on ? 3 : StyleSheet.hairlineWidth, backgroundColor: colors.surface2 }]}
                    >
                      {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
                      <LinearGradient colors={['transparent', 'rgba(4,21,37,0.3)', 'rgba(4,21,37,0.9)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
                      <View style={styles.purposeText}>
                        <Txt size={15} weight="semibold" style={styles.white}>
                          {t(p.title)}
                        </Txt>
                        <Txt size={11} style={styles.whiteSoft}>
                          {t(p.sub)}
                        </Txt>
                      </View>
                      {on ? (
                        <View style={[styles.tick, { backgroundColor: colors.accent }]}>
                          <Check size={14} color={colors.navy} strokeWidth={3} />
                        </View>
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Title
              title={renter ? t('ميزانيتك الشهرية؟', 'Monthly budget?') : t('ميزانيتك القصوى؟', 'Your top budget?')}
              sub={t('مش هنعرضها لحد. بنستخدمها بس عشان نرتب لك الأنسب.', 'Never shown to anyone. We only use it to rank what fits you.')}
            />
            <View style={styles.budget}>
              <BudgetBox value={budget} onCommit={(v) => setBudget(Math.min(scale.max, Math.max(scale.min, v)))} />
              <Txt size={12} color="ink3" align="center">
                {renter ? t('في الشهر', 'per month') : t('إجمالي سعر الوحدة', 'total unit price')}
              </Txt>
            </View>
            <BudgetSlider
              scale={scale}
              value={budget}
              onChange={setBudget}
              label={t('الميزانية', 'Budget')}
              valueText={fmtMoney(budget, lang)}
            />
            <View accessibilityRole="radiogroup" style={styles.presets}>
              {scale.presets.map((v) => (
                <View key={v} style={styles.preset}>
                  <ToggleChip
                    role="radio"
                    label={fmtMoney(v, lang)}
                    text={fmtMoney(v, lang).replace(' ج.م', '').replace('EGP ', '')}
                    selected={budget === v}
                    onPress={() => setBudget(v)}
                  />
                </View>
              ))}
            </View>
          </>
        ) : null}

        {step === 2 ? <AreasStep picked={areas} onToggle={(id) => setAreas((a) => toggle(a, id))} /> : null}

        {step === 3 ? (
          <>
            <Title title={t('نوع الوحدة؟', 'What kind of home?')} sub={t('اختار نوع أو أكتر، أو سيبها مفتوحة.', 'Pick one or more, or leave it open.')} />
            <View style={styles.chips}>
              {PROPERTY_TYPES.map((k) => (
                <ToggleChip key={k} label={t(PROPERTY_TYPE_LABEL[k])} selected={types.includes(k)} onPress={() => setTypes((x) => toggle(x, k))} />
              ))}
            </View>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Title title={t('إيه اللي يهمك؟', 'What matters to you?')} />
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t('أقل عدد غرف', 'Minimum bedrooms')}
              </Txt>
              <View accessibilityRole="radiogroup" style={styles.chips}>
                {Array.from({ length: PREFS_BEDS_MAX + 1 }, (_, n) => (
                  <ToggleChip
                    key={n}
                    role="radio"
                    label={n === 0 ? t('أي عدد', 'Any') : bedsLabel(n, lang)}
                    text={n === 0 ? t('أي', 'Any') : n === PREFS_BEDS_MAX ? `${fmtNum(n, lang)}+` : fmtNum(n, lang)}
                    selected={beds === n}
                    onPress={() => setBeds(n)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t('مميزات لازم تكون موجودة', 'Must-haves')}
              </Txt>
              <View style={styles.chips}>
                {INTERESTS.map((f) => (
                  <ToggleChip key={f} label={t(FEATURE_LABEL[f])} selected={interests.includes(f)} onPress={() => setInterests((x) => toggle(x, f))} />
                ))}
              </View>
            </View>
            <View style={[styles.count, { backgroundColor: colors.ink }]} accessibilityLiveRegion="polite">
              <Sparkles size={24} color={colors.accent} />
              <View style={styles.countText}>
                <Txt size={20} weight="semibold" style={{ color: colors.accent }}>
                  {count.data ? fmtNum(count.data.count, lang) : '…'}
                </Txt>
                <Txt size={14} style={{ color: colors.bg }}>
                  {t(`عقار يناسبك بنسبة ${localDigits('70', 'ar')}٪ أو أكتر`, 'homes match you 70% or more')}
                </Txt>
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {save.isError ? (
          <Txt color="danger" align="center" accessibilityLiveRegion="polite">
            {t('معرفناش نحفظ تفضيلاتك. جرّب تاني.', 'Couldn’t save your preferences. Try again.')}
          </Txt>
        ) : null}
        <Button
          label={last ? (saved ? t('احفظ تفضيلاتك', 'Save preferences') : t('اعرض ترشيحاتي', 'Show my picks')) : t('التالي', 'Next')}
          loading={last && save.isPending}
          onPress={last ? finish : () => setStep((s) => s + 1)}
        />
      </View>
    </View>
  );
}

const bedsLabel = (n: number, lang: 'ar' | 'en') =>
  lang === 'ar' ? (n === 1 ? 'غرفة أو أكتر' : `${fmtNum(n, 'ar')} غرف أو أكتر`) : `${n}+ bedrooms`;

function Title({ title, sub }: { title: string; sub?: string }) {
  return (
    <View style={styles.title}>
      <Txt accessibilityRole="header" size={26} weight="semibold" style={styles.titleText}>
        {title}
      </Txt>
      {sub ? (
        <Txt size={14} color="ink2">
          {sub}
        </Txt>
      ) : null}
    </View>
  );
}

/** The budget as a big number you can also type over, in Arabic or Latin digits. */
function BudgetBox({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [typing, setTyping] = useState<string | null>(null);
  const commit = () => {
    const n = typing === null ? undefined : parseDigits(typing);
    if (n !== undefined) onCommit(n);
    setTyping(null);
  };
  return (
    <TextInput
      accessibilityLabel={t('اكتب الميزانية', 'Type the budget')}
      keyboardType="number-pad"
      returnKeyType="done"
      value={typing ?? fmtMoney(value, lang, false)}
      onFocus={() => setTyping(String(value))}
      onChangeText={setTyping}
      onBlur={commit}
      onSubmitEditing={commit}
      style={[styles.budgetInput, { color: colors.accentInk }]}
    />
  );
}

function AreasStep({ picked, onToggle }: { picked: string[]; onToggle: (id: string) => void }): ReactNode {
  const t = useT();
  const { colors } = useTheme();
  const areas = useAreas();
  return (
    <>
      <Title title={t('بتدور فين؟', 'Where are you looking?')} sub={t('اختار منطقة أو أكتر، أو سيبها مفتوحة.', 'Pick one or more areas, or leave it open.')} />
      <View style={styles.grid}>
        {(areas.data ?? []).map((a) => {
          const on = picked.includes(a.id);
          const img = mediaUrl(a.image);
          return (
            <Pressable
              key={a.id}
              accessibilityRole="checkbox"
              accessibilityLabel={t({ ar: a.nameAr, en: a.nameEn })}
              accessibilityState={{ checked: on }}
              onPress={() => onToggle(a.id)}
              style={[styles.area, { backgroundColor: colors.surface, borderColor: on ? colors.accent : colors.line, borderWidth: on ? 2 : StyleSheet.hairlineWidth }]}
            >
              <View style={[styles.areaImg, { backgroundColor: colors.surface2 }]}>
                {img ? <Image source={{ uri: img }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              </View>
              <View style={styles.flex}>
                <Txt size={13} weight="semibold" numberOfLines={1}>
                  {t({ ar: a.nameAr, en: a.nameEn })}
                </Txt>
                <Txt size={11} color="ink3" numberOfLines={1}>
                  {t({ ar: a.cityAr, en: a.cityEn })}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  topSpace: { width: 44, height: 44 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  dash: { flex: 1, height: 6, borderRadius: 3 },
  body: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24, gap: 24 },
  title: { gap: 8 },
  titleText: { lineHeight: 34 },
  group: { gap: 12 },
  input: { height: 56, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  purpose: { width: '47%', flexGrow: 1, height: 128, borderRadius: radius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  purposeText: { padding: 12 },
  white: { color: '#fff' },
  whiteSoft: { color: 'rgba(255,255,255,0.8)' },
  tick: { position: 'absolute', top: 10, end: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  budget: { alignItems: 'center', gap: 4, paddingTop: 16 },
  budgetInput: { fontSize: 36, fontWeight: '600', textAlign: 'center', minWidth: 200 },
  presets: { flexDirection: 'row', gap: 8 },
  preset: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  area: { width: '47%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: radius.md },
  areaImg: { width: 48, height: 48, borderRadius: 12, overflow: 'hidden' },
  count: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: radius.lg },
  countText: { flex: 1, gap: 2 },
  footer: { paddingHorizontal: 20, paddingTop: 12, gap: 8 },
  flex: { flex: 1 },
});
