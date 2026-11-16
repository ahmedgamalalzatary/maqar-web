import { Stack } from 'expo-router';
import { useDir } from '@/core/i18n';
import { stackOptions } from '@/core/navigation/transitions';
import { RoleGate } from '@/features/auth/components/role-gate';

/** The sales agent app: the tabs, and the lead page over them. */
export default function AgentLayout() {
  return (
    <RoleGate role="agent">
      <Stack screenOptions={stackOptions(useDir())} />
    </RoleGate>
  );
}
