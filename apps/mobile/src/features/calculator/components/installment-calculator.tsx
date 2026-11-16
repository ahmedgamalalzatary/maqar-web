import { fmtMoney, fmtNum, fmtPct, installment, localDigits, minDownOf, yearsLimits } from '@maqar/shared';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { Segmented } from '@/components/segmented';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useCalculatorLimits } from '@/core/app-config/store';
import { m, useLang, useT } from '@/core/i18n';
import { CSS_EASE_OUT } from '@/core/motion/motion';
import { useTweenedNumber } from '@/core/motion/tween';
import { radius, useTheme } from '@/core/theme';
import { BudgetSlider } from '@/features/prefs/components/budget-slider';
import { parseAmount, parseRate, parseYears } from '../rate';

const PRICE_SCALE = { min: 1_000_000, max: 40_000_000, step: 100_000 };
const DOWN_MAX = 60;
const DOWN_STEP = 5;
const DEFAULT_RATE = 18;
/** The most a typed price can be. */
const PRICE_MAX = 10_000_000_000;

/** A number as the fields show it: no separators, one decimal at most, in the app's digits. */
const fieldText = (n: number, lang: 'ar' | 'en') => {
  const s = String(Math.round(n * 10) / 10);
  return lang === 'ar' ? localDigits(s, 'ar').replace('.', '٫') : s;
};

type Mode = 'dev' | 'bank';
type Frequency = 'monthly' | 'quarterly';

/**
 * The calculator (contract §8.11), on its own screen and on the property page.
 * Nothing here is saved: the numbers are estimates to try out. An admin sets the least down
 * payment and the years it takes (phase 29); with `ownPlan` the defaults are the listing's own
 * plan, which is always allowed.
 */
export function InstallmentCalculator({
  price: initialPrice,
  defaultDown,
  defaultYears,
  ownPlan = false,
  editablePrice = false,
}: {
  price: number;
  defaultDown: number;
  defaultYears: number;
  ownPlan?: boolean;
  editablePrice?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [typedPrice, setTypedPrice] = useState(initialPrice);
  const limits = useCalculatorLimits();
  const downScale = { min: minDownOf(limits, ownPlan ? defaultDown : undefined), max: DOWN_MAX, step: DOWN_STEP };
  const [pickedDown, setPickedDown] = useState(defaultDown);
  const down = Math.max(downScale.min, pickedDown);
  // The down payment and the price can also be typed (owner, 2026-11-14). A field being typed in
  // keeps its own text; the others show the numbers in use.
  const [typing, setTyping] = useState<{ field: 'pct' | 'amount' | 'price'; text: string } | null>(null);
  // Typed, not picked (2026-11-12), inside the admin's range, or the listing's own plan.
  const { min: minYears, max: maxYears } = yearsLimits(limits, ownPlan ? defaultYears : undefined);
  const inRange = (n: number) => Math.min(maxYears, Math.max(minYears, n));
  const [yearsText, setYearsText] = useState(localDigits(String(inRange(defaultYears)), lang));
  const typedYears = parseYears(yearsText, maxYears, minYears);
  const [lastYears, setLastYears] = useState(inRange(defaultYears));
  // Brought inside the limits as they are now: a refresh can change them while this is open.
  const years = typedYears ?? inRange(lastYears);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [mode, setMode] = useState<Mode>('dev');
  const [rateText, setRateText] = useState(localDigits(String(DEFAULT_RATE), lang));

  const price = editablePrice ? typedPrice : initialPrice;
  const downAmount = (price * down) / 100;
  const inDownRange = (p: number) => p >= downScale.min && p <= downScale.max;
  // What is typed into a down payment field, as a percent; undefined while it is not a number.
  const typedPct = typing?.field === 'pct' ? parseAmount(typing.text) : typing?.field === 'amount' ? ((parseAmount(typing.text) ?? NaN) / price) * 100 : undefined;
  const downOutOfRange = typing !== null && typing.field !== 'price' && typedPct !== undefined && !Number.isNaN(typedPct) && !inDownRange(typedPct);
  const setDown = (p: number) => {
    setTyping(null);
    setPickedDown(p);
  };
  const typeDown = (field: 'pct' | 'amount', text: string) => {
    setTyping({ field, text });
    const n = parseAmount(text);
    if (n === undefined || price <= 0) return;
    const p = field === 'pct' ? n : (n / price) * 100;
    if (inDownRange(p)) setPickedDown(p);
  };
  const typePrice = (text: string) => {
    setTyping({ field: 'price', text });
    const n = parseAmount(text);
    if (n !== undefined && n >= 1 && n <= PRICE_MAX) setTypedPrice(Math.round(n));
  };
  const shown = (field: 'pct' | 'amount' | 'price', n: number) => (typing?.field === field ? typing.text : fieldText(n, lang));
  const rate = parseRate(rateText);
  const plan = installment(price, down, years, mode === 'bank' ? rate : 0, frequency === 'quarterly');
  const downShare = plan.total > 0 ? (plan.down / plan.total) * 100 : 0;
  const changeYears = (text: string) => {
    setYearsText(text);
    // Any whole number counts, brought inside the range: "15" must not leave the "1" typed on the way.
    const n = parseYears(text, 99);
    if (n !== undefined) setLastYears(inRange(n));
  };
  const cream = { color: colors.cream };
  const faded = { color: colors.cream, opacity: 0.7 };

  return (
    <View style={styles.wrap}>
      {editablePrice ? (
        <View>
          <View style={styles.labelRow}>
            <Txt size={13} weight="medium" color="ink2">
              {t(m.common.unitPrice)}
            </Txt>
            <Txt size={15} weight="semibold">
              {fmtMoney(price, lang, false)}
            </Txt>
          </View>
          <BudgetSlider
            scale={PRICE_SCALE}
            value={price}
            onChange={(p) => {
              setTyping(null);
              setTypedPrice(p);
            }}
            label={t(m.common.unitPrice)}
            valueText={fmtMoney(price, lang, false)}
          />
          <TextField
            label={t(m.calculator.unitPriceEgp)}
            value={shown('price', price)}
            onChangeText={typePrice}
            onEndEditing={() => setTyping(null)}
            keyboardType="number-pad"
            maxLength={14}
          />
        </View>
      ) : null}

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'dev', label: t(m.calculator.developerPlan0) },
          { value: 'bank', label: t(m.calculator.bankFinance) },
        ]}
      />

      <View style={[styles.result, { backgroundColor: colors.navy }]}>
        <Txt size={12} style={faded}>
          {frequency === 'monthly' ? t(m.common.monthlyInstallment) : t(m.calculator.quarterlyInstallment)}
        </Txt>
        <Payment value={Math.round(plan.payment)} color={colors.gold} />
        {/* The down payment's share of the total grows and shrinks instead of jumping (2026-11-16). */}
        <View style={styles.bar}>
          <Animated.View style={[styles.barFill, { width: `${downShare}%`, backgroundColor: colors.gold }]} />
        </View>
        <View style={styles.figures}>
          <Figure label={t(m.calculator.yourDownPayment)} value={fmtMoney(Math.round(plan.down), lang)} labelStyle={faded} valueStyle={cream} />
          <Figure label={t(m.calculator.installments)} value={fmtNum(plan.count, lang)} labelStyle={faded} valueStyle={cream} />
          <Figure label={t(m.calculator.total)} value={fmtMoney(Math.round(plan.total), lang)} labelStyle={faded} valueStyle={cream} />
        </View>
      </View>

      <View>
        <View style={styles.labelRow}>
          <Txt size={13} weight="medium" color="ink2">
            {t(m.common.downPayment)}
          </Txt>
          <Txt size={15} weight="semibold">
            {fmtPct(down, lang)}
          </Txt>
        </View>
        <BudgetSlider
          scale={downScale}
          value={down}
          onChange={setDown}
          label={t(m.common.downPayment)}
          valueText={fmtPct(down, lang)}
        />
        <View style={styles.downFields}>
          <View style={styles.flex}>
            <TextField
              label={t(m.calculator.downPayment)}
              value={shown('pct', down)}
              onChangeText={(v) => typeDown('pct', v)}
              onEndEditing={() => setTyping(null)}
              keyboardType="decimal-pad"
              maxLength={5}
            />
          </View>
          <View style={styles.flex}>
            <TextField
              label={t(m.calculator.downPaymentEgp)}
              value={shown('amount', downAmount)}
              onChangeText={(v) => typeDown('amount', v)}
              onEndEditing={() => setTyping(null)}
              keyboardType="number-pad"
              maxLength={14}
            />
          </View>
        </View>
        {downOutOfRange ? (
          <Txt size={12} color="danger">
            {t(m.calculator.downRange(downScale.min, downScale.max))}
          </Txt>
        ) : null}
      </View>

      <View style={styles.years}>
        <TextField
          label={t(m.calculator.paymentPeriodYears)}
          value={yearsText}
          onChangeText={changeYears}
          onEndEditing={() => setYearsText(localDigits(String(years), lang))}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Txt size={12} color={typedYears === undefined ? 'danger' : 'ink3'}>
          {t(m.calculator.yearsRange(minYears, maxYears))}
        </Txt>
      </View>

      <Segmented
        value={frequency}
        onChange={setFrequency}
        options={[
          { value: 'monthly', label: t(m.calculator.monthly) },
          { value: 'quarterly', label: t(m.calculator.quarterly) },
        ]}
      />

      {mode === 'bank' ? (
        <TextField
          label={t(m.calculator.annualInterest)}
          value={rateText}
          onChangeText={setRateText}
          onEndEditing={() => setRateText(localDigits(String(rate), lang))}
          keyboardType="decimal-pad"
        />
      ) : null}

      <View style={styles.note}>
        <Info size={14} color={colors.ink3} />
        <Txt size={11.5} color="ink3" style={styles.flex}>
          {t(
            m.calculator.estimatesForGuidanceYourSales,
          )}
        </Txt>
      </View>
    </View>
  );
}

/**
 * The installment, counting to each new value like an odometer (2026-11-16). Only this line
 * re-renders while it counts; a screen reader hears the final number once.
 */
function Payment({ value, color }: { value: number; color: string }) {
  const lang = useLang();
  const shown = Math.round(useTweenedNumber(value));
  const text = fmtMoney(value, lang, false);
  return (
    <Txt size={32} weight="semibold" style={{ color }} accessibilityLabel={text} accessibilityLiveRegion="polite">
      {fmtMoney(shown, lang, false)}
    </Txt>
  );
}

function Figure({
  label,
  value,
  labelStyle,
  valueStyle,
}: {
  label: string;
  value: string;
  labelStyle: { color: string; opacity: number };
  valueStyle: { color: string };
}) {
  return (
    <View style={styles.flex}>
      <Txt size={11} style={labelStyle}>
        {label}
      </Txt>
      <Txt size={13} weight="semibold" style={valueStyle}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  result: { borderRadius: radius.lg, padding: 20, gap: 4 },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 12 },
  // Out of the flow with no children, so easing its width re-lays-out nothing else.
  barFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    start: 0,
    borderRadius: 4,
    transitionProperty: 'width',
    transitionDuration: 300,
    transitionTimingFunction: CSS_EASE_OUT,
  },
  figures: { flexDirection: 'row', gap: 8, marginTop: 12 },
  years: { gap: 8 },
  downFields: { flexDirection: 'row', gap: 10, marginTop: 12 },
  note: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
});
