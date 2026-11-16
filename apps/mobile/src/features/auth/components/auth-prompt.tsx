import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { Button } from '@/components/button';
import { Sheet } from '@/components/sheet';
import { Txt } from '@/components/text';
import { m, useT } from '@/core/i18n';
import { setPendingAction } from '../pending-action';

export const useAuthPrompt = create<{ open: boolean }>(() => ({ open: false }));

/** The "sign in to continue" sheet. Render once, at the root. */
export function AuthPromptHost() {
  const t = useT();
  const router = useRouter();
  const open = useAuthPrompt((s) => s.open);
  // Backing out drops the saved action: a later sign-in from elsewhere must not replay it.
  const close = () => {
    setPendingAction(null);
    useAuthPrompt.setState({ open: false });
  };
  const go = (href: '/sign-in' | '/sign-up') => {
    useAuthPrompt.setState({ open: false });
    router.push(href);
  };
  return (
    <Sheet open={open} onClose={close} title={t(m.auth.signInFirst)}>
      <Txt color="ink2">
        {t(
          m.auth.youNeedAnAccountTo,
        )}
      </Txt>
      <View style={styles.actions}>
        <Button label={t(m.common.signIn)} onPress={() => go('/sign-in')} />
        <Button label={t(m.common.createAnAccount)} variant="secondary" onPress={() => go('/sign-up')} />
        <Button label={t(m.auth.notNow)} variant="ghost" onPress={close} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({ actions: { gap: 8 } });
