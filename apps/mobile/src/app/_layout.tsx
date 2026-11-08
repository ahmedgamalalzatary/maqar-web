import { AppProviders } from '@/core/providers/app-providers';
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
