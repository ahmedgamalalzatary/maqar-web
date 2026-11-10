import { Stack } from 'expo-router';
import { RoleGate } from '@/features/auth/components/role-gate';

/** The sales agent app: the tabs, and the lead page over them. */
export default function AgentLayout() {
  return (
    <RoleGate role="agent">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
