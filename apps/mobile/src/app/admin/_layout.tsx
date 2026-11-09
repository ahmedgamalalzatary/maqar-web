import { RoleTabs } from '@/core/navigation/role-tabs';
import { RoleGate } from '@/features/auth/components/role-gate';

/** The admin tools in the app (contract §16.1 #6: the web dashboard comes too). */
export default function AdminTabs() {
  return (
    <RoleGate role="admin">
      <RoleTabs role="admin" />
    </RoleGate>
  );
}
