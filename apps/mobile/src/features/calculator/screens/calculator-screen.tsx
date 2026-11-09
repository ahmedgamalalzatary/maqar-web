import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { useDir, useT } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { InstallmentCalculator } from '../components/installment-calculator';

/** The standalone calculator (contract §8.11). It starts from the demo's example home. */
export function CalculatorScreen() {
  const t = useT();
  const router = useRouter();
  const { colors } = useTheme();
  const BackIcon = useDir() === 'rtl' ? ArrowRight : ArrowLeft;
  return (
    <Screen
      title={t('حاسبة التقسيط', 'Installment calculator')}
      right={
        <IconButton
          label={t('رجوع', 'Back')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          icon={<BackIcon size={20} color={colors.ink} />}
        />
      }
    >
      <InstallmentCalculator price={8_000_000} defaultDown={10} defaultYears={6} editablePrice />
    </Screen>
  );
}
