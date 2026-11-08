import { RoleTabs } from '@/core/navigation/role-tabs';
import { RoleGate } from '@/features/auth/components/role-gate';

export default function ClientTabs() {
  return (
    <RoleGate role="client">
      <RoleTabs role="client" />
    </RoleGate>
  );
}
