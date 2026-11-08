import { useRouter } from 'expo-router';
import { Building2, Calculator, Handshake, KeyRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';
import { radius, useTheme } from '@/core/theme';

/** Home of the store build: who Maqar is and what it helps with. */
export function StoreHomeScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const icon = (I: typeof Building2) => <I size={22} color={colors.accentInk} strokeWidth={1.8} />;

  return (
    <Screen>
      <View style={[styles.hero, { backgroundColor: colors.navy }]}>
        <Logo width={150} onDark />
        <Txt size={15} align="center" style={{ color: colors.cream, opacity: 0.85 }}>
          {t(
            'مقر بيساعدك تلاقي بيتك: شقق وفلل للبيع والإيجار ومشروعات جديدة في مصر.',
            'Maqar helps you find your home: apartments and villas to buy or rent, and new projects in Egypt.',
          )}
        </Txt>
      </View>

      <Feature icon={icon(Building2)} title={t('بيوت للبيع', 'Homes for sale')} body={t('شقق، فلل، توين هاوس وشاليهات في أهم المناطق.', 'Apartments, villas, twin houses and chalets in the main areas.')} />
      <Feature icon={icon(KeyRound)} title={t('إيجار', 'Rentals')} body={t('إيجار طويل وإقامات قصيرة.', 'Long-term rentals and short stays.')} />
      <Feature icon={icon(Handshake)} title={t('مستشار معاك', 'An advisor with you')} body={t('مستشاري مقر بيساعدوك من أول معاينة لحد العقد.', 'Maqar advisors help you from the first viewing to the contract.')} />

      <Button label={t('احسب قسطك', 'Work out your installment')} onPress={() => router.push('/calculator')} />
      <View style={styles.calcHint}>
        <Calculator size={16} color={colors.ink3} />
        <Txt size={12} color="ink3">
          {t('اعرف القسط الشهري لأي وحدة في ثواني.', 'See the monthly payment for any unit in seconds.')}
        </Txt>
      </View>
    </Screen>
  );
}

function Feature({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  const { colors } = useTheme();
  return (
    <Card style={styles.feature}>
      <View style={[styles.featureIcon, { backgroundColor: colors.accentSoft }]}>{icon}</View>
      <View style={styles.flex}>
        <Txt weight="semibold">{title}</Txt>
        <Txt size={13} color="ink2">
          {body}
        </Txt>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 16, borderRadius: radius.lg, padding: 24 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: { width: 46, height: 46, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  calcHint: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  flex: { flex: 1 },
});
