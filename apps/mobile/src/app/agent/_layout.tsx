import { RoleTabs } from '@/core/navigation/role-tabs';
import { RoleGate } from '@/features/auth/components/role-gate';

export default function AgentTabs() {
  return (
    <RoleGate role="agent">
      <RoleTabs role="agent" />
    </RoleGate>
  );
}
