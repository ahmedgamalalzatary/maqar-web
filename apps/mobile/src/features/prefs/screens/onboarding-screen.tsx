import {
  BUDGET_SCALE,
  type Category,
  DEFAULT_PREFS,
  FEATURE_LABEL,
  type Feature,
  fmtMoney,
  fmtNum,
  PREFS_BEDS_MAX,
  type Prefs,
  PROPERTY_TYPE_LABEL,
  PROPERTY_TYPES,
  type PropertyType,
} from '@maqar/shared';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { takePendingAction } from '@/features/auth/pending-action';
import { ArrowLeft, ArrowRight, Check, Sparkles } from 'lucide-react-native';
import { type ReactNode, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import { CSS_EASE_OUT, EASE_OUT } from '@/core/motion/motion';
import { KeyboardAvoiding } from '@/components/keyboard-avoiding';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { Txt } from '@/components/text';
import { mediaUrl } from '@/core/api/api';
import { m, useDir, useLang, useT } from '@/core/i18n';
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
// Module scope: layout-animation builders made in render cost every re-render.
const STEP_FROM_RIGHT = FadeInRight.duration(280).easing(EASE_OUT);
const STEP_FROM_LEFT = FadeInLeft.duration(280).easing(EASE_OUT);

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
  const [forward, setForward] = useState(true);
  const go = (by: 1 | -1) => {
    setForward(by > 0);
    setStep((s) => s + by);
  };
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
      {
        onSuccess: () => {
          // A sign-up that interrupted a guest's task resumes it; onboarding opened on its own
          // just goes back (or to the client home the first time).
          const resume = takePendingAction();
          if (resume) resume();
          else if (saved) router.back();
          else router.replace('/');
        },
      },
    );
  };

  const last = step === STEPS - 1;
  const Back = rtl ? ArrowRight : ArrowLeft;
  // Forward comes in from the reading direction's end, back from its start (2026-11-16).
  const fromRight = forward !== rtl;

  return (
    <KeyboardAvoiding style={{ backgroundColor: colors.bg, paddingTop: insets.top + 12 }}>
      <View style={styles.top}>
        {step > 0 ? (
          <IconButton label={t(m.common.back)} onPress={() => go(-1)} icon={<Back size={20} color={colors.ink} />} />
        ) : (
          <View style={styles.topSpace} />
        )}
        <View style={styles.progress} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {Array.from({ length: STEPS }, (_, i) => (
            <Animated.View key={i} style={[styles.dash, { backgroundColor: i <= step ? colors.accent : colors.surface3 }]} />
          ))}
        </View>
        {saved ? (
          <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
            <Txt size={13} weight="medium" color="ink2">
              {t(m.common.cancel)}
            </Txt>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" onPress={finish} disabled={save.isPending} hitSlop={8}>
            <Txt size={13} weight="medium" color="ink2">
              {t(m.common.skip)}
            </Txt>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} entering={step === 0 && forward ? undefined : fromRight ? STEP_FROM_RIGHT : STEP_FROM_LEFT} style={styles.step}>
        {step === 0 ? (
          <>
            <Title
              title={saved ? t(m.common.editYourPreferences) : t(m.prefs.welcomeToMaqar)}
              sub={t(m.prefs.aFewQuickQuestionsAnd)}
            />
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t(m.common.yourNameOptional)}
              </Txt>
              <TextInput
                accessibilityLabel={t(m.common.yourNameOptional)}
                value={name}
                onChangeText={setName}
                placeholder={t(m.prefs.eGAhmed)}
                placeholderTextColor={colors.ink3}
                autoComplete="name"
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.line, color: colors.ink, textAlign: rtl ? 'right' : 'left' }]}
              />
            </View>
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t(m.prefs.whatAreYouLookingFor)}
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
              title={renter ? t(m.prefs.monthlyBudget) : t(m.prefs.yourTopBudget)}
              sub={t(m.prefs.neverShownToAnyoneWe)}
            />
            <View style={styles.budget}>
              <BudgetBox value={budget} onCommit={(v) => setBudget(Math.min(scale.max, Math.max(scale.min, v)))} />
              <Txt size={12} color="ink3" align="center">
                {renter ? t(m.prefs.perMonth) : t(m.prefs.totalUnitPrice)}
              </Txt>
            </View>
            <BudgetSlider
              scale={scale}
              value={budget}
              onChange={setBudget}
              label={t(m.prefs.budget)}
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
            <Title title={t(m.prefs.whatKindOfHome)} sub={t(m.prefs.pickOneOrMoreOr)} />
            <View style={styles.chips}>
              {PROPERTY_TYPES.map((k) => (
                <ToggleChip key={k} label={t(PROPERTY_TYPE_LABEL[k])} selected={types.includes(k)} onPress={() => setTypes((x) => toggle(x, k))} />
              ))}
            </View>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <Title title={t(m.prefs.whatMattersToYou)} />
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t(m.prefs.minimumBedrooms)}
              </Txt>
              <View accessibilityRole="radiogroup" style={styles.chips}>
                {Array.from({ length: PREFS_BEDS_MAX + 1 }, (_, n) => (
                  <ToggleChip
                    key={n}
                    role="radio"
                    label={n === 0 ? t(m.prefs.any) : t(m.prefs.bedsOrMore(n))}
                    text={n === 0 ? t(m.prefs.any2) : n === PREFS_BEDS_MAX ? `${fmtNum(n, lang)}+` : fmtNum(n, lang)}
                    selected={beds === n}
                    onPress={() => setBeds(n)}
                  />
                ))}
              </View>
            </View>
            <View style={styles.group}>
              <Txt size={13} weight="medium" color="ink2">
                {t(m.prefs.mustHaves)}
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
                  {t(m.prefs.homesMatch70)}
                </Txt>
              </View>
            </View>
          </>
        ) : null}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        {save.isError ? (
          <Txt color="danger" align="center" accessibilityLiveRegion="polite">
            {t(m.prefs.couldntSaveYourPreferencesTry)}
          </Txt>
        ) : null}
        <Button
          label={last ? (saved ? t(m.prefs.savePreferences) : t(m.prefs.showMyPicks)) : t(m.common.next)}
          loading={last && save.isPending}
          onPress={last ? finish : () => go(1)}
        />
      </View>
    </KeyboardAvoiding>
  );
}

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
      accessibilityLabel={t(m.prefs.typeTheBudget)}
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
      <Title title={t(m.prefs.whereAreYouLooking)} sub={t(m.prefs.pickOneOrMoreAreas)} />
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
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  topSpace: { width: 44, height: 44 },
  progress: { flex: 1, flexDirection: 'row', gap: 6 },
  dash: { flex: 1, height: 6, borderRadius: 3, transitionProperty: 'backgroundColor', transitionDuration: 260, transitionTimingFunction: CSS_EASE_OUT },
  step: { gap: 24 },
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
