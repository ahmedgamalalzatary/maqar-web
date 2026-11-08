import { Languages, Moon, Sun } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { IconButton } from '@/components/icon-button';
import { Logo } from '@/components/logo';
import { Screen } from '@/components/screen';
import { useLang } from '@/core/i18n';
import { useTheme } from '@/core/theme';
import { usePreferences } from '@/features/account/hooks/use-account';
import { ApiStatus } from '@/features/health/components/api-status';

/** Client home. Phase 0: the logo, one-tap language and theme switches, and the API status. */
export function Home() {
  const lang = useLang();
  const { scheme, colors } = useTheme();
  const { setLang, setTheme } = usePreferences();
  return (
    <Screen>
      <View style={styles.header}>
        <Logo width={76} />
        <View style={styles.actions}>
          <IconButton
            label={lang === 'ar' ? 'English' : 'العربية'}
            onPress={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            icon={<Languages color={colors.ink} size={20} strokeWidth={1.8} />}
          />
          <IconButton
            label={
              scheme === 'dark'
                ? lang === 'ar'
                  ? 'الوضع الفاتح'
                  : 'Light mode'
                : lang === 'ar'
                  ? 'الوضع الداكن'
                  : 'Dark mode'
            }
            onPress={() => setTheme(scheme === 'dark' ? 'light' : 'dark')}
            icon={
              scheme === 'dark' ? (
                <Sun color={colors.ink} size={20} strokeWidth={1.8} />
              ) : (
                <Moon color={colors.ink} size={20} strokeWidth={1.8} />
              )
            }
          />
        </View>
      </View>
      <ApiStatus />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 8 },
});
