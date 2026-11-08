import { RoleTabs } from '@/core/navigation/role-tabs';
import { RoleGate } from '@/features/auth/components/role-gate';

export default function OwnerTabs() {
  return (
    <RoleGate role="owner">
      <RoleTabs role="owner" />
    </RoleGate>
  );
}
