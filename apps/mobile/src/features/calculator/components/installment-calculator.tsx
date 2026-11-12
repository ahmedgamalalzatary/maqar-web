import { fmtMoney, fmtNum, fmtPct, installment, localDigits } from '@maqar/shared';
import { Info } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Segmented } from '@/components/segmented';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';
import { BudgetSlider } from '@/features/prefs/components/budget-slider';
import { MAX_YEARS, parseRate, parseYears } from '../rate';

const PRICE_SCALE = { min: 1_000_000, max: 40_000_000, step: 100_000 };
const DOWN_SCALE = { min: 0, max: 60, step: 5 };
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
  // Typed, not picked (2026-11-12): 1 to 10 years, or longer when the listing's own plan is.
  const maxYears = Math.max(MAX_YEARS, defaultYears);
  const [yearsText, setYearsText] = useState(localDigits(String(defaultYears), lang));
  const typedYears = parseYears(yearsText, maxYears);
  const [lastYears, setLastYears] = useState(defaultYears);
  const years = typedYears ?? lastYears;
  const [frequency, setFrequency] = useState<Frequency>('monthly');
  const [mode, setMode] = useState<Mode>('dev');
  const [rateText, setRateText] = useState(localDigits(String(DEFAULT_RATE), lang));

  const price = editablePrice ? typedPrice : initialPrice;
  const rate = parseRate(rateText);
  const plan = installment(price, down, years, mode === 'bank' ? rate : 0, frequency === 'quarterly');
  const downShare = plan.total > 0 ? (plan.down / plan.total) * 100 : 0;
  const changeYears = (text: string) => {
    setYearsText(text);
    // Any whole number counts, capped at the limit: "15" must not leave the "1" typed on the way.
    const n = parseYears(text, 99);
    if (n !== undefined) setLastYears(Math.min(n, maxYears));
  };
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
        <TextField
          label={t('مدة التقسيط (بالسنين)', 'Payment period (years)')}
          value={yearsText}
          onChangeText={changeYears}
          onEndEditing={() => setYearsText(localDigits(String(years), lang))}
          keyboardType="number-pad"
          maxLength={2}
        />
        <Txt size={12} color={typedYears === undefined ? 'danger' : 'ink3'}>
          {t(`من ١ لـ ${fmtNum(maxYears, 'ar')} سنين`, `1 to ${maxYears} years`)}
        </Txt>
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
          onEndEditing={() => setRateText(localDigits(String(rate), lang))}
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
  note: { flexDirection: 'row', gap: 6 },
  flex: { flex: 1 },
});
