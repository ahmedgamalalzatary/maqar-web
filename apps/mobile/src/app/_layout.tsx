import { Stack } from 'expo-router';
import { StatusBarScrim } from '@/components/status-bar-scrim';
import { ThemeSwitchHost } from '@/components/theme-switch';
import { useDir } from '@/core/i18n';
import { RISE, stackOptions } from '@/core/navigation/transitions';
import { AppProviders } from '@/core/providers/app-providers';
import { AuthPromptHost } from '@/features/auth/components/auth-prompt';
import { useSession } from '@/features/auth/store/session.store';
import { ChatBridge } from '@/features/chat/components/chat-bridge';
import { PeekHost } from '@/features/listings/components/peek';
import { PushBridge } from '@/features/notifications/components/push-bridge';
import { OpeningHost } from '@/features/splash/components/opening-screen';

// Resume the saved session before the splash screen hides.
const restoreSession = () => useSession.getState().restore();

/**
 * The property page draws its own way in: it grows out of the card tapped (CardGrow), over the
 * list, which stays drawn behind it.
 */
const GROWS = {
  presentation: 'transparentModal' as const,
  animation: 'none' as const,
  gestureEnabled: false,
  contentStyle: { backgroundColor: 'transparent' },
};

export default function RootLayout() {
  const dir = useDir();
  return (
    <AppProviders boot={restoreSession} overlay={<OpeningHost />}>
      <Stack screenOptions={stackOptions(dir)}>
        <Stack.Screen name="sign-in" options={{ presentation: 'modal', ...RISE }} />
        <Stack.Screen name="sign-up" options={{ presentation: 'modal', ...RISE }} />
        <Stack.Screen name="property/[id]/index" options={GROWS} />
        <Stack.Screen name="property/[id]/book" options={RISE} />
      </Stack>
      <StatusBarScrim />
      <PeekHost />
      <AuthPromptHost />
      <PushBridge />
      <ChatBridge />
      <ThemeSwitchHost />
    </AppProviders>
  );
}
