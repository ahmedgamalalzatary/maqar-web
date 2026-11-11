import { Stack } from 'expo-router';
import { StatusBarScrim } from '@/components/status-bar-scrim';
import { AppProviders } from '@/core/providers/app-providers';
import { AuthPromptHost } from '@/features/auth/components/auth-prompt';
import { useSession } from '@/features/auth/store/session.store';
import { ChatBridge } from '@/features/chat/components/chat-bridge';
import { PushBridge } from '@/features/notifications/components/push-bridge';

// Resume the saved session before the splash screen hides.
const restoreSession = () => useSession.getState().restore();

export default function RootLayout() {
  return (
    <AppProviders boot={restoreSession}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
        <Stack.Screen name="sign-up" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBarScrim />
      <AuthPromptHost />
      <PushBridge />
      <ChatBridge />
    </AppProviders>
  );
}
