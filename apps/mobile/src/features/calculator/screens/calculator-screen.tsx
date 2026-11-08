import { fmtMoney, installment, localDigits } from '@maqar/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Card } from '@/components/card';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { TextField } from '@/components/text-field';
import { useLang, useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

const DOWN_OPTIONS = [10, 20, 30, 40];
const YEAR_OPTIONS = [3, 5, 7, 10];

/** Installment calculator (contract §8.11): price, down payment and years give the monthly payment. */
export function CalculatorScreen() {
  const t = useT();
  const lang = useLang();
  const { colors } = useTheme();
  const [priceText, setPriceText] = useState('5000000');
  const [downPct, setDownPct] = useState(10);
  const [years, setYears] = useState(7);

  // Accept Arabic-Indic digits too, and ignore separators.
  const price = Number(priceText.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/\D/g, '')) || 0;
  const plan = installment(price, downPct, years);

  return (
    <Screen title={t('حاسبة التقسيط', 'Installment calculator')}>
      <TextField
        label={t('سعر الوحدة (ج.م)', 'Unit price (EGP)')}
        value={priceText}
        onChangeText={setPriceText}
        keyboardType="number-pad"
      />

      <Choice
        label={t('المقدّم', 'Down payment')}
        options={DOWN_OPTIONS}
        value={downPct}
        onChange={setDownPct}
        format={(v) => (lang === 'ar' ? `${localDigits(String(v), 'ar')}٪` : `${v}%`)}
      />
      <Choice
        label={t('مدة التقسيط', 'Years to pay')}
        options={YEAR_OPTIONS}
        value={years}
        onChange={setYears}
        format={(v) => (lang === 'ar' ? `${localDigits(String(v), 'ar')} سنين` : `${v} years`)}
      />

      <Card style={[styles.result, { backgroundColor: colors.navy, borderColor: colors.navy }]}>
        <Txt size={13} style={{ color: colors.cream, opacity: 0.75 }}>
          {t('القسط الشهري', 'Monthly payment')}
        </Txt>
        <Txt size={30} weight="bold" style={{ color: colors.gold }} accessibilityLiveRegion="polite">
          {fmtMoney(Math.round(plan.payment), lang, false)}
        </Txt>
        <View style={styles.rows}>
          <Row label={t('المقدّم', 'Down payment')} value={fmtMoney(plan.down, lang)} />
          <Row label={t('عدد الأقساط', 'Payments')} value={localDigits(String(plan.count), lang)} />
          <Row label={t('الإجمالي', 'Total')} value={fmtMoney(Math.round(plan.total), lang)} />
        </View>
      </Card>

      <Txt size={12} color="ink3">
        {t(
          'الحساب تقريبي على أساس خطة بدون فوايد، زي أغلب خطط المطورين.',
          'An estimate for a 0% interest plan, like most developer plans.',
        )}
      </Txt>
    </Screen>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
  format,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.choice}>
      <Txt size={13} weight="medium" color="ink2">
        {label}
      </Txt>
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {options.map((o) => {
          const on = o === value;
          return (
            <Pressable
              key={o}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(o)}
              style={[
                styles.chip,
                { backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.line2 },
              ]}
            >
              <Txt size={14} weight="medium" style={{ color: on ? colors.navy : colors.ink }}>
                {format(o)}
              </Txt>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Txt size={13} style={{ color: colors.cream, opacity: 0.75 }}>
        {label}
      </Txt>
      <Txt size={14} weight="semibold" style={{ color: colors.cream }}>
        {value}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  choice: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: radius.full, borderWidth: 1, justifyContent: 'center' },
  result: { gap: 4, paddingVertical: 20 },
  rows: { gap: 6, marginTop: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
