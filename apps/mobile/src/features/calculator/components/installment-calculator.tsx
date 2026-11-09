import { fmtMoney, fmtNum, fmtPct, installment } from '@maqar/shared';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Segmented } from '@/components/segmented';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { ToggleChip } from '@/features/listings/components/chips';
import { BudgetSlider } from '@/features/prefs/components/budget-slider';
import { parseRate } from '../rate';

const PRICE_SCALE = { min: 1_000_000, max: 40_000_000, step: 100_000 };
const DOWN_SCALE = { min: 0, max: 60, step: 5 };
const YEARS = [1, 2, 3, 4, 5, 6, 7, 8, 10];
const DEFAULT_RATE = 18;

type Mode = 'dev' | 'bank';
type Frequency = 'monthly' | 'quarterly';

/**
 * The calculator (contract §8.11), on its own screen and on the property page.
 * Nothing here is saved: the numbers are estimates to try out.
 */
export function InstallmentCalculator({
  price: initialPrice,
  defaultDown,
  defaultYears,
  editablePrice = false,
}: {
  price: number;
  defaultDown: number;
  defaultYears: number;
  editablePrice?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [typedPrice, setTypedPrice] = useState(initialPrice);
  const [down, setDown] = useState(defaultDown);
  const [years, setYears] = useState(defaultYears);
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [mode, setMode] = useState<Mode>('dev');
  const [rateText, setRateText] = useState(String(DEFAULT_RATE));

  const price = editablePrice ? typedPrice : initialPrice;
  const rate = parseRate(rateText);
  const plan = installment(price, down, years, mode === 'bank' ? rate : 0, frequency === 'quarterly');
  const downShare = plan.total > 0 ? (plan.down / plan.total) * 100 : 0;
  // A listing's plan can run for years that are not among the usual choices.
  const yearOptions = YEARS.includes(defaultYears) ? YEARS : [...YEARS, defaultYears].sort((a, b) => a - b);
  const yearsLabel = (y: number) =>
    t(y === 1 ? 'سنة' : y === 2 ? 'سنتين' : `${fmtNum(y, 'ar')} سنين`, y === 1 ? '1 year' : `${y} years`);
  const cream = { color: colors.cream };
  const faded = { color: colors.cream, opacity: 0.7 };

  return (
    <View style={styles.wrap}>
      {editablePrice ? (
        <View>
          <View style={styles.labelRow}>
            <Txt size={13} weight="medium" color="ink2">
              {t('سعر الوحدة', 'Unit price')}
            </Txt>
            <Txt size={15} weight="semibold">
              {fmtMoney(price, lang, false)}
            </Txt>
          </View>
          <BudgetSlider
            scale={PRICE_SCALE}
            value={price}
            onChange={setTypedPrice}
            label={t('سعر الوحدة', 'Unit price')}
            valueText={fmtMoney(price, lang, false)}
          />
        </View>
      ) : null}

      <Segmented
        value={mode}
        onChange={setMode}
        options={[
          { value: 'dev', label: t('خطة المطوّر (بدون فوايد)', 'Developer plan (0%)') },
          { value: 'bank', label: t('تمويل بنكي', 'Bank finance') },
        ]}
      />

      <View style={[styles.result, { backgroundColor: colors.navy }]}>
        <Txt size={12} style={faded}>
          {frequency === 'monthly' ? t('القسط الشهري', 'Monthly installment') : t('القسط الربع سنوي', 'Quarterly installment')}
        </Txt>
        <Txt size={32} weight="semibold" style={{ color: colors.gold }} accessibilityLiveRegion="polite">
          {fmtMoney(Math.round(plan.payment), lang, false)}
        </Txt>
        <View style={styles.bar}>
          <View style={[styles.barFill, { width: `${downShare}%`, backgroundColor: colors.gold }]} />
        </View>
        <View style={styles.figures}>
          <Figure label={t('مقدمك', 'Your down payment')} value={fmtMoney(Math.round(plan.down), lang)} labelStyle={faded} valueStyle={cream} />
          <Figure label={t('عدد الأقساط', 'Installments')} value={fmtNum(plan.count, lang)} labelStyle={faded} valueStyle={cream} />
          <Figure label={t('الإجمالي', 'Total')} value={fmtMoney(Math.round(plan.total), lang)} labelStyle={faded} valueStyle={cream} />
        </View>
      </View>

      <View>
        <View style={styles.labelRow}>
          <Txt size={13} weight="medium" color="ink2">
            {t('المقدم', 'Down payment')}
          </Txt>
          <Txt size={15} weight="semibold">
            {fmtPct(down, lang)}
          </Txt>
        </View>
        <BudgetSlider
          scale={DOWN_SCALE}
          value={down}
          onChange={setDown}
          label={t('المقدم', 'Down payment')}
          valueText={fmtPct(down, lang)}
        />
      </View>

      <View style={styles.years}>
        <Txt size={13} weight="medium" color="ink2">
          {t('مدة التقسيط', 'Payment period')}
        </Txt>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.yearChips} accessibilityRole="radiogroup">
          {yearOptions.map((y) => (
            <ToggleChip key={y} role="radio" label={yearsLabel(y)} selected={years === y} onPress={() => setYears(y)} />
          ))}
        </ScrollView>
      </View>

      <Segmented
        value={frequency}
        onChange={setFrequency}
        options={[
          { value: 'monthly', label: t('شهري', 'Monthly') },
          { value: 'quarterly', label: t('ربع سنوي', 'Quarterly') },
        ]}
      />

      {mode === 'bank' ? (
        <TextField
          label={t('نسبة الفايدة السنوية ٪', 'Annual interest %')}
          value={rateText}
          onChangeText={setRateText}
          onEndEditing={() => setRateText(String(rate))}
          keyboardType="decimal-pad"
        />
      ) : null}

      <View style={styles.note}>
        <Info size={14} color={colors.ink3} />
        <Txt size={11.5} color="ink3" style={styles.flex}>
          {t(
            'أرقام تقديرية للتوضيح. مسؤول المبيعات بيأكد الخطة النهائية معاك وقت المعاينة.',
            'Estimates for guidance. Your sales advisor confirms the final plan with you at the viewing.',
          )}
        </Txt>
      </View>
    </View>
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
  barFill: { height: '100%', borderRadius: 4 },
  figures: { flexDirection: 'row', gap: 8, marginTop: 12 },
  years: { gap: 8 },
  yearChips: { gap: 8 },
  note: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
});
