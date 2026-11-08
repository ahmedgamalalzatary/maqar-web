import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { useT } from '@/core/i18n';

export const useAuthPrompt = create<{ open: boolean }>(() => ({ open: false }));

/** The "sign in to continue" sheet. Render once, at the root. */
export function AuthPromptHost() {
  const t = useT();
  const router = useRouter();
  const open = useAuthPrompt((s) => s.open);
  const close = () => useAuthPrompt.setState({ open: false });
  const go = (href: '/sign-in' | '/sign-up') => {
    close();
    router.push(href);
  };
  return (
    <Sheet open={open} onClose={close} title={t('سجّل دخولك الأول', 'Sign in first')}>
      <Txt color="ink2">
        {t(
          'محتاج حساب عشان تحفظ البيوت، تتابع الأسعار، تحجز معاينة أو تكلّم المستشار.',
          'You need an account to save homes, follow prices, book viewings or chat with an advisor.',
        )}
      </Txt>
      <View style={styles.actions}>
        <Button label={t('تسجيل الدخول', 'Sign in')} onPress={() => go('/sign-in')} />
        <Button label={t('إنشاء حساب', 'Create an account')} variant="secondary" onPress={() => go('/sign-up')} />
        <Button label={t('مش دلوقتي', 'Not now')} variant="ghost" onPress={close} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ actions: { gap: 8 } });
