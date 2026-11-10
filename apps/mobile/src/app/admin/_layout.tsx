import { Stack } from 'expo-router';
import { RoleGate } from '@/features/auth/components/role-gate';

/** The admin tools in the app (contract §16.1 #6; the web dashboard has the same): the tabs, and the listing pages over them. */
export default function AdminLayout() {
  return (
    <RoleGate role="admin">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
